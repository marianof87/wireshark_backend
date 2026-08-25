import type { IncomingMessage, RequestListener } from "node:http";
import {
  cuposDisponibles,
  inscribir,
  validarSolicitud,
  type MotivoRechazo
} from "../dominio/inscripciones.ts";
import {
  crearRepositorioEnMemoria,
  type Repositorio
} from "../datos/repositorio-en-memoria.ts";

/**
 * Capa HTTP: traduce solicitudes a llamadas al dominio y decisiones del dominio
 * a códigos de estado. No contiene reglas académicas.
 */

export interface OpcionesAplicacion {
  repositorio?: Repositorio;
  /** Inyectable para que las pruebas obtengan fechas deterministas. */
  reloj?: () => Date;
}

/** Cada motivo de rechazo tiene un único código y mensaje: el contrato es estable. */
const RESPUESTA_POR_MOTIVO: Record<MotivoRechazo, { codigo: number; error: string }> = {
  "estudiante-inexistente": { codigo: 404, error: "Estudiante no encontrado" },
  "materia-inexistente": { codigo: 404, error: "Materia no encontrada" },
  "estudiante-inactivo": { codigo: 409, error: "El estudiante no está activo" },
  "inscripcion-duplicada": { codigo: 409, error: "El estudiante ya está inscripto en esta materia" },
  "sin-cupo": { codigo: 409, error: "La materia no tiene cupo disponible" }
};

/**
 * Tabla de rutas: qué métodos admite cada forma de ruta.
 *
 * Existe para poder distinguir dos situaciones que un router ingenuo confunde:
 * "no conozco ese recurso" (404) y "conozco el recurso, pero no esa operación
 * sobre él" (405, con el encabezado `Allow` diciendo cuáles sí). También permite
 * contestar `OPTIONS` sin repetir las reglas en otro lugar.
 */
const RUTAS: ReadonlyArray<{ patron: RegExp; metodos: readonly string[] }> = [
  { patron: /^\/$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/salud$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/hora$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/materias$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/estudiantes\/[^/]+$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/estudiantes\/[^/]+\/inscripciones$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/estudiantes$/, metodos: ["POST"] },
  { patron: /^\/inscripciones$/, metodos: ["POST"] },
  { patron: /^\/ping$/, metodos: ["GET", "HEAD"] },
  { patron: /^\/echo$/, metodos: ["POST"] }
];

export function crearAplicacion(opciones: OpcionesAplicacion = {}): RequestListener {
  const repositorio = opciones.repositorio ?? crearRepositorioEnMemoria();
  const reloj = opciones.reloj ?? (() => new Date());

  return async (solicitud, respuesta) => {
    respuesta.setHeader("Content-Type", "application/json; charset=utf-8");

    const metodoSolicitado = solicitud.method ?? "";

    // HEAD es GET sin cuerpo. Se resuelve con el mismo manejador —abajo se lee
    // `metodo`, no `metodoSolicitado`— y `responder` omite el cuerpo al final.
    // De este modo ninguna ruta puede quedar con GET y sin HEAD.
    const esHead = metodoSolicitado === "HEAD";
    const metodo = esHead ? "GET" : metodoSolicitado;

    const ruta = (solicitud.url ?? "").split("?")[0] ?? "";
    const partes = ruta.split("/").filter((parte) => parte !== "");

    /**
     * Escribe la respuesta. Serializa una sola vez para poder anunciar
     * `Content-Length`: el largo del cuerpo es información de la capa de
     * aplicación, TCP no lo transporta. Sin ese encabezado el cliente sólo sabe
     * que el mensaje terminó cuando se cierra la conexión (o por trozos).
     * Con `cuerpo` indefinido se responde sin cuerpo alguno, como pide el 204.
     */
    const responder = (codigo: number, cuerpo?: unknown): void => {
      if (cuerpo === undefined) {
        respuesta.removeHeader("Content-Type");
        respuesta.writeHead(codigo);
        respuesta.end();
        return;
      }

      const serializado = JSON.stringify(cuerpo);

      respuesta.setHeader("Content-Length", Buffer.byteLength(serializado, "utf8"));
      respuesta.writeHead(codigo);
      respuesta.end(esHead ? undefined : serializado);
    };

    const conocida = RUTAS.find(({ patron }) => patron.test(ruta));

    if (conocida !== undefined) {
      // `OPTIONS` siempre se admite: es la forma de preguntarle a la ruta qué acepta.
      const admitidos = [...conocida.metodos, "OPTIONS"].join(", ");

      if (metodoSolicitado === "OPTIONS") {
        respuesta.setHeader("Allow", admitidos);
        responder(204);
        return;
      }

      if (!conocida.metodos.includes(metodo)) {
        respuesta.setHeader("Allow", admitidos);
        responder(405, { error: "Método no permitido" });
        return;
      }
    }

    // GET /
    if (metodo === "GET" && partes.length === 0) {
      responder(200, { mensaje: "API funcionando correctamente. Prueba con /salud, /ping o /materias." });
      return;
    }

    // GET /salud
    if (metodo === "GET" && partes.length === 1 && partes[0] === "salud") {
      responder(200, { estado: "ok", fecha: reloj().toISOString() });
      return;
    }

    // GET /ping
    if (metodo === "GET" && partes.length === 1 && partes[0] === "ping") {
      responder(200, { ping: "pong" });
      return;
    }

    // GET /hora
    if (metodo === "GET" && partes.length === 1 && partes[0] === "hora") {
      responder(200, { hora: reloj().toISOString() });
      return;
    }

    // GET /materias
    if (metodo === "GET" && partes.length === 1 && partes[0] === "materias") {
      const estado = repositorio.estado();

      responder(
        200,
        estado.materias.map((materia) => ({
          ...materia,
          cuposDisponibles: cuposDisponibles(estado, materia.codigo)
        }))
      );
      return;
    }

    // GET /estudiantes/:id  y  GET /estudiantes/:id/inscripciones
    if (metodo === "GET" && partes[0] === "estudiantes" && partes.length >= 2 && partes.length <= 3) {
      const id = Number(partes[1]);

      if (!Number.isInteger(id)) {
        responder(400, { error: "El id debe ser un número entero" });
        return;
      }

      const estado = repositorio.estado();
      const estudiante = estado.estudiantes.find((e) => e.id === id);

      if (estudiante === undefined) {
        responder(404, { error: "Estudiante no encontrado" });
        return;
      }

      if (partes.length === 2) {
        responder(200, estudiante);
        return;
      }

      if (partes[2] === "inscripciones") {
        responder(
          200,
          estado.inscripciones.filter((i) => i.estudianteId === id)
        );
        return;
      }
    }

    // POST /echo
    if (metodo === "POST" && partes.length === 1 && partes[0] === "echo") {
      let cuerpo: unknown;

      try {
        cuerpo = await leerJson(solicitud);
      } catch {
        responder(400, { error: "El cuerpo no es JSON válido" });
        return;
      }

      responder(200, cuerpo);
      return;
    }

    // POST /estudiantes
    if (metodo === "POST" && partes.length === 1 && partes[0] === "estudiantes") {
      let cuerpo: any;

      try {
        cuerpo = await leerJson(solicitud);
      } catch {
        responder(400, { error: "JSON inválido" });
        return;
      }

      if (!cuerpo.nombre) {
        responder(400, { error: "El campo 'nombre' es requerido" });
        return;
      }

      const nuevoEstudiante = {
        id: Math.floor(Math.random() * 1000) + 1,
        nombre: cuerpo.nombre,
        activo: cuerpo.activo ?? true
      };

      responder(201, nuevoEstudiante);
      return;
    }

    // POST /inscripciones
    if (metodo === "POST" && partes.length === 1 && partes[0] === "inscripciones") {
      let cuerpo: unknown;

      try {
        cuerpo = await leerJson(solicitud);
      } catch {
        responder(400, { error: "El cuerpo no es JSON válido" });
        return;
      }

      const validacion = validarSolicitud(cuerpo);

      if (!validacion.valida) {
        responder(400, { error: validacion.error });
        return;
      }

      const resultado = inscribir(validacion.solicitud, repositorio.estado(), reloj());

      if (resultado.estado === "rechazada") {
        const { codigo, error } = RESPUESTA_POR_MOTIVO[resultado.motivo];

        responder(codigo, { error });
        return;
      }

      repositorio.agregarInscripcion(resultado.inscripcion);
      respuesta.setHeader("Location", `/inscripciones/${resultado.inscripcion.id}`);
      responder(201, resultado.inscripcion);
      return;
    }

    responder(404, { error: "Recurso no encontrado" });
  };
}

/** Acumula el cuerpo de la solicitud y lo interpreta como JSON. */
async function leerJson(solicitud: IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];

  for await (const trozo of solicitud) {
    trozos.push(trozo as Buffer);
  }

  const texto = Buffer.concat(trozos).toString("utf8");

  return texto === "" ? {} : JSON.parse(texto);
}
