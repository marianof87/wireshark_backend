import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearAplicacion } from "./aplicacion.ts";
import { levantar, type ServidorDePrueba } from "../pruebas/servidor-de-prueba.ts";

/**
 * Pruebas de caracterización: fijan la conducta que el servidor YA tenía antes
 * de refactorizarlo. No agregan funcionalidad; son la red de seguridad que
 * permite mover el código sin cambiar lo que el cliente observa.
 */
describe("Aplicación HTTP · conducta heredada de la Unidad 1", () => {
  let servidor: ServidorDePrueba;

  beforeEach(async () => {
    servidor = await levantar(crearAplicacion());
  });

  afterEach(async () => {
    await servidor.cerrar();
  });

  it("responde 200 y estado ok en GET /salud", async () => {
    const respuesta = await servidor.pedir("/salud");

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ estado: "ok" });
  });

  it("responde la hora en ISO 8601 en GET /hora", async () => {
    const respuesta = await servidor.pedir("/hora");
    const cuerpo = (await respuesta.json()) as { hora: string };

    expect(respuesta.status).toBe(200);
    expect(new Date(cuerpo.hora).toISOString()).toBe(cuerpo.hora);
  });

  it("devuelve el estudiante existente en GET /estudiantes/42", async () => {
    const respuesta = await servidor.pedir("/estudiantes/42");

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ id: 42, nombre: "Juan Gómez", activo: false });
  });

  it("responde 404 cuando el estudiante no existe", async () => {
    const respuesta = await servidor.pedir("/estudiantes/999");

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: "Estudiante no encontrado" });
  });

  it("responde 400 cuando el id no es un número entero", async () => {
    const respuesta = await servidor.pedir("/estudiantes/abc");

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: "El id debe ser un número entero" });
  });

  it("responde 404 en cualquier otra ruta", async () => {
    const respuesta = await servidor.pedir("/ruta-inexistente");

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: "Recurso no encontrado" });
  });

  // Hueco detectado leyendo el reporte de cobertura: la rama de una subruta
  // desconocida bajo un estudiante existente no estaba ejercitada.
  it("responde 404 ante una subruta desconocida de un estudiante existente", async () => {
    const respuesta = await servidor.pedir("/estudiantes/1/notas");

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: "Recurso no encontrado" });
  });

  it("declara JSON con codificación UTF-8 en todas las respuestas", async () => {
    const respuesta = await servidor.pedir("/salud");

    expect(respuesta.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });
});

describe("Nuevos endpoints XP: GET /ping y POST /echo", () => {
  let servidor: ServidorDePrueba;

  beforeEach(async () => {
    servidor = await levantar(crearAplicacion());
  });

  afterEach(async () => {
    await servidor.cerrar();
  });

  it("responde 200 y { ping: 'pong' } en GET /ping", async () => {
    const respuesta = await servidor.pedir("/ping");

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ping: "pong" });
  });

  it("responde 200 y devuelve el mismo cuerpo en POST /echo", async () => {
    const cuerpoPeticion = { mensaje: "hola TDD" };
    const respuesta = await servidor.pedir("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoPeticion)
    });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual(cuerpoPeticion);
  });
});

describe("POST /estudiantes (XP Phase)", () => {
  let servidor: ServidorDePrueba;

  beforeEach(async () => {
    servidor = await levantar(crearAplicacion());
  });

  afterEach(async () => {
    await servidor.cerrar();
  });

  it("debe responder 201 Created y retornar el estudiante creado con su id asignado", async () => {
    const nuevoEstudiante = { nombre: "Mariano Capella", activo: true };

    const respuesta = await servidor.pedir("/estudiantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevoEstudiante)
    });

    const datos = (await respuesta.json()) as any;

    expect(respuesta.status).toBe(201);
    expect(datos.nombre).toBe("Mariano Capella");
    expect(datos.activo).toBe(true);
    expect(typeof datos.id).toBe("number");
  });

  it("debe responder 400 Bad Request si faltan datos requeridos", async () => {
    const respuesta = await servidor.pedir("/estudiantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) // Cuerpo sin nombre
    });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: "El campo 'nombre' es requerido" });
  });
});

/**
 * Pruebas de integración de la historia nueva: recorren el contrato completo
 * —ruta, método, cuerpo, código de estado— sin conocer cómo está implementado
 * el dominio. Las reglas ya tienen sus propias pruebas unitarias; acá sólo se
 * verifica que la traducción a HTTP sea la acordada.
 */
describe("POST /inscripciones", () => {
  const FECHA = new Date("2026-03-10T12:00:00.000Z");
  let servidor: ServidorDePrueba;

  const inscribir = (cuerpo: unknown): Promise<Response> =>
    servidor.pedir("/inscripciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)
    });

  beforeEach(async () => {
    servidor = await levantar(crearAplicacion({ reloj: () => FECHA }));
  });

  afterEach(async () => {
    await servidor.cerrar();
  });

  it("registra la inscripción de un estudiante activo y responde 201", async () => {
    const respuesta = await inscribir({ estudianteId: 1, materia: "algoritmos" });

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({
      id: 1,
      estudianteId: 1,
      materia: "algoritmos",
      fecha: "2026-03-10T12:00:00.000Z"
    });
  });

  it("indica en Location dónde quedó la inscripción creada", async () => {
    const respuesta = await inscribir({ estudianteId: 1, materia: "algoritmos" });

    expect(respuesta.headers.get("location")).toBe("/inscripciones/1");
  });

  it("descuenta el cupo de la materia", async () => {
    await inscribir({ estudianteId: 1, materia: "algoritmos" });

    const respuesta = await servidor.pedir("/materias");
    const materias = (await respuesta.json()) as { codigo: string; cuposDisponibles: number }[];

    expect(materias.find((m) => m.codigo === "algoritmos")).toMatchObject({ cuposDisponibles: 1 });
  });

  it("responde 409 cuando el estudiante no está activo", async () => {
    const respuesta = await inscribir({ estudianteId: 42, materia: "algoritmos" });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({ error: "El estudiante no está activo" });
  });

  it("responde 409 ante una inscripción repetida", async () => {
    await inscribir({ estudianteId: 1, materia: "algoritmos" });
    const respuesta = await inscribir({ estudianteId: 1, materia: "algoritmos" });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({
      error: "El estudiante ya está inscripto en esta materia"
    });
  });

  it("responde 409 cuando la materia agotó el cupo", async () => {
    await inscribir({ estudianteId: 1, materia: "bases" });
    const respuesta = await inscribir({ estudianteId: 7, materia: "bases" });

    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toEqual({ error: "La materia no tiene cupo disponible" });
  });

  it("responde 404 cuando el estudiante no existe", async () => {
    const respuesta = await inscribir({ estudianteId: 999, materia: "algoritmos" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: "Estudiante no encontrado" });
  });

  it("responde 404 cuando la materia no está en la oferta", async () => {
    const respuesta = await inscribir({ estudianteId: 1, materia: "quimica" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: "Materia no encontrada" });
  });

  it("responde 400 cuando falta un campo obligatorio", async () => {
    const respuesta = await inscribir({ materia: "algoritmos" });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({
      error: "El campo estudianteId debe ser un número entero"
    });
  });

  it("responde 400 cuando el cuerpo no es JSON válido", async () => {
    const respuesta = await inscribir("{ esto no es json");

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: "El cuerpo no es JSON válido" });
  });

  // Hueco detectado leyendo el reporte de cobertura: el cuerpo vacío se trata
  // como objeto vacío y debe fallar por validación, no por JSON inválido.
  it("responde 400 cuando la solicitud llega sin cuerpo", async () => {
    const respuesta = await servidor.pedir("/inscripciones", { method: "POST" });

    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({
      error: "El campo estudianteId debe ser un número entero"
    });
  });

  it("no registra nada cuando la inscripción es rechazada", async () => {
    await inscribir({ estudianteId: 42, materia: "algoritmos" });

    const respuesta = await servidor.pedir("/estudiantes/42/inscripciones");

    expect(await respuesta.json()).toEqual([]);
  });
});

describe("GET /estudiantes/:id/inscripciones", () => {
  let servidor: ServidorDePrueba;

  beforeEach(async () => {
    servidor = await levantar(crearAplicacion());
  });

  afterEach(async () => {
    await servidor.cerrar();
  });

  it("devuelve una lista vacía cuando el estudiante no se inscribió", async () => {
    const respuesta = await servidor.pedir("/estudiantes/1/inscripciones");

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual([]);
  });

  it("devuelve sólo las inscripciones de ese estudiante", async () => {
    const cuerpo = (estudianteId: number, materia: string): RequestInit => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estudianteId, materia })
    });

    await servidor.pedir("/inscripciones", cuerpo(1, "algoritmos"));
    await servidor.pedir("/inscripciones", cuerpo(7, "bases"));

    const respuesta = await servidor.pedir("/estudiantes/1/inscripciones");
    const inscripciones = (await respuesta.json()) as { materia: string }[];

    expect(inscripciones).toHaveLength(1);
    expect(inscripciones[0]).toMatchObject({ estudianteId: 1, materia: "algoritmos" });
  });

  it("responde 404 cuando el estudiante no existe", async () => {
    const respuesta = await servidor.pedir("/estudiantes/999/inscripciones");

    expect(respuesta.status).toBe(404);
    expect(await respuesta.json()).toEqual({ error: "Estudiante no encontrado" });
  });
});

/**
 * Contrato a nivel de método y encabezado. Estas pruebas nacieron de la consigna
 * de la Unidad 1 (sección 7: "casos de prueba" con `curl -i`) y de la demostración
 * con analizador de paquetes: lo que se ve en Wireshark es exactamente esto.
 *
 * `HEAD` merece pruebas propias porque es el único método cuya respuesta no tiene
 * cuerpo pero sí declara su tamaño: es la prueba de que `Content-Length` viaja en
 * la capa de aplicación y no la calcula TCP.
 */
describe("Contrato HTTP · métodos y encabezados", () => {
  let servidor: ServidorDePrueba;

  beforeEach(async () => {
    servidor = await levantar(crearAplicacion());
  });

  afterEach(async () => {
    await servidor.cerrar();
  });

  it("responde HEAD /salud con el mismo código que GET y sin cuerpo", async () => {
    const respuesta = await servidor.pedir("/salud", { method: "HEAD" });

    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe("");
  });

  it("anuncia en HEAD el mismo Content-Length que tendría el cuerpo de GET", async () => {
    const conCuerpo = await servidor.pedir("/materias");
    const sinCuerpo = await servidor.pedir("/materias", { method: "HEAD" });

    const bytes = Buffer.byteLength(await conCuerpo.text(), "utf8");

    expect(sinCuerpo.headers.get("content-length")).toBe(String(bytes));
    expect(conCuerpo.headers.get("content-length")).toBe(String(bytes));
  });

  it("responde HEAD sobre una ruta inexistente con 404 y sin cuerpo", async () => {
    const respuesta = await servidor.pedir("/ruta-inexistente", { method: "HEAD" });

    expect(respuesta.status).toBe(404);
    expect(await respuesta.text()).toBe("");
  });

  it("responde OPTIONS con 204 y anuncia los métodos admitidos", async () => {
    const respuesta = await servidor.pedir("/materias", { method: "OPTIONS" });

    expect(respuesta.status).toBe(204);
    expect(respuesta.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(await respuesta.text()).toBe("");
  });

  it("responde 405 —y no 404— cuando la ruta existe pero el método no", async () => {
    const respuesta = await servidor.pedir("/materias", { method: "DELETE" });

    expect(respuesta.status).toBe(405);
    expect(respuesta.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(await respuesta.json()).toEqual({ error: "Método no permitido" });
  });

  it("distingue el método admitido en cada ruta: /inscripciones sólo acepta POST", async () => {
    const respuesta = await servidor.pedir("/inscripciones");

    expect(respuesta.status).toBe(405);
    expect(respuesta.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it("declara Content-Length en las respuestas con cuerpo", async () => {
    const respuesta = await servidor.pedir("/salud");
    const bytes = Buffer.byteLength(await respuesta.text(), "utf8");

    expect(respuesta.headers.get("content-length")).toBe(String(bytes));
    expect(respuesta.headers.get("transfer-encoding")).toBeNull();
  });
});
