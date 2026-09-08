import { describe, expect, it, beforeEach } from "vitest";
import { AppError } from "../errors/app-error.ts";
import {
  TareasService,
  validarCrearTarea,
  validarActualizarTarea,
  validarIdTarea
} from "./tareas.service.ts";
import { crearRepositorioTareasMock } from "../test/mocks/tareas.repository.mock.ts";
import { crearRepositorioProyectosMock } from "../test/mocks/proyectos.repository.mock.ts";

/** Ejecuta una operación async, captura el `AppError` lanzado y lo devuelve. */
async function capturarAppError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (error) {
    return error as AppError;
  }
  throw new Error("Se esperaba que la operación lanzara un error");
}

/** Ejecuta una validación síncrona y captura su `AppError`. */
function capturarAppErrorSync(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    return error as AppError;
  }
  throw new Error("Se esperaba que la operación lanzara un error");
}

/**
 * Pruebas unitarias del servicio de tareas usando repositorios SIMULADOS (datos
 * mock). El mock de proyectos arranca con los proyectos 1 y 2; el mock de tareas
 * arranca con dos tareas del proyecto 1.
 */
describe("TareasService (con repositorios mock)", () => {
  let service: TareasService;

  beforeEach(() => {
    service = new TareasService(
      crearRepositorioTareasMock(),
      crearRepositorioProyectosMock()
    );
  });

  it("crea una tarea para un proyecto existente del mock", async () => {
    const creada = await service.crear({
      proyectoId: 1,
      titulo: "Implementar autenticación",
      prioridad: "alta"
    });

    expect(creada.id).toBe(3);
    expect(creada.completada).toBe(false);
    expect(await service.obtenerTodas()).toHaveLength(3);
  });

  it("rechaza 404 PROJECT_NOT_FOUND si la tarea referencia un proyecto inexistente", async () => {
    const error = await capturarAppError(() =>
      service.crear({ proyectoId: 999, titulo: "Tarea huérfana", prioridad: "baja" })
    );

    expect(error.status).toBe(404);
    expect(error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("busca una tarea por id existente en el mock", async () => {
    expect(await service.buscarPorId(1)).toMatchObject({
      id: 1,
      titulo: "Diseñar el modelo de datos"
    });
  });

  it("lanza 404 TASK_NOT_FOUND si la tarea no existe", async () => {
    const error = await capturarAppError(() => service.buscarPorId(999));

    expect(error.status).toBe(404);
    expect(error.code).toBe("TASK_NOT_FOUND");
  });

  it("modifica parcialmente (PATCH) completada a true", async () => {
    const actualizada = await service.modificarParcial(1, { completada: true });

    expect(actualizada.completada).toBe(true);
    expect(actualizada.titulo).toBe("Diseñar el modelo de datos"); // se conserva
  });

  it("filtra el listado por estado completada", async () => {
    const pendientes = await service.obtenerTodas({ completada: false });
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].id).toBe(1);
  });

  it("filtra el listado por texto (q)", async () => {
    const resultado = await service.obtenerTodas({ q: "login" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(2);
  });

  it("elimina una tarea existente", async () => {
    await service.eliminar(1);
    expect((await capturarAppError(() => service.buscarPorId(1))).status).toBe(404);
  });

  it("lanza 404 al eliminar una tarea inexistente", async () => {
    const error = await capturarAppError(() => service.eliminar(888));

    expect(error.status).toBe(404);
  });

  // === Nuevos casos XP: reemplazo, filtros y PATCH extendido ===

  it("reemplazar (PUT) actualiza titulo, prioridad y completada", async () => {
    const actualizada = await service.reemplazar(1, {
      titulo: "Titulo reemplazado",
      prioridad: "baja",
      completada: true
    });

    expect(actualizada).toMatchObject({
      id: 1,
      titulo: "Titulo reemplazado",
      prioridad: "baja",
      completada: true
    });
    // se conserva proyectoId y fechaCreacion
    expect(actualizada.proyectoId).toBe(1);
    expect(typeof actualizada.fechaCreacion).toBe("string");
  });

  it("lanza 404 TASK_NOT_FOUND al reemplazar una tarea inexistente", async () => {
    const error = await capturarAppError(() => service.reemplazar(999, { titulo: "No existe" }));

    expect(error.status).toBe(404);
    expect(error.code).toBe("TASK_NOT_FOUND");
  });

  it("obtenerTodas filtra por proyectoId", async () => {
    // proyecto 1 tiene 2 tareas; proyecto 2 tiene 0 inicialmente
    const deProyecto1 = await service.obtenerTodas({ proyectoId: 1 });
    expect(deProyecto1).toHaveLength(2);

    const deProyecto2 = await service.obtenerTodas({ proyectoId: 2 });
    expect(deProyecto2).toHaveLength(0);

    // creamos una tarea en proyecto 2 y verificamos filtro
    await service.crear({ proyectoId: 2, titulo: "Tarea de Beta", prioridad: "media" });
    const trasCrear = await service.obtenerTodas({ proyectoId: 2 });
    expect(trasCrear).toHaveLength(1);
    expect(trasCrear[0].titulo).toBe("Tarea de Beta");
  });

  it("obtenerTodas con filtro vacío devuelve todas", async () => {
    const todas = await service.obtenerTodas();
    expect(todas).toHaveLength(2);

    const todasConFiltroVacio = await service.obtenerTodas({});
    expect(todasConFiltroVacio).toHaveLength(2);
  });

  it("modificarParcial actualiza prioridad y titulo", async () => {
    const actualizada = await service.modificarParcial(1, { prioridad: "baja", titulo: "Nuevo titulo" });

    expect(actualizada).toMatchObject({ id: 1, prioridad: "baja", titulo: "Nuevo titulo" });
    expect(actualizada.completada).toBe(false); // se conserva
  });

  it("modificarParcial conserva campos no enviados", async () => {
    const actualizada = await service.modificarParcial(2, { completada: false });

    expect(actualizada).toMatchObject({ id: 2, titulo: "Maquetar pantalla de login", prioridad: "media" });
    expect(actualizada.completada).toBe(false);
  });

  it("reemplazar conserva fechaCreacion", async () => {
    const antes = await service.buscarPorId(1);
    const despues = await service.reemplazar(1, { titulo: "Cambia titulo" });

    expect(despues.fechaCreacion).toBe(antes.fechaCreacion);
  });
});

describe("Validaciones de la tarea", () => {
  it("rechaza prioridad fuera del enum con 422 INVALID_PRIORITY", () => {
    const error = capturarAppErrorSync(() =>
      validarCrearTarea({ proyectoId: 1, titulo: "Tarea", prioridad: "urgente" })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_PRIORITY");
  });

  it("rechaza título corto con 422 INVALID_TITLE", () => {
    const error = capturarAppErrorSync(() =>
      validarCrearTarea({ proyectoId: 1, titulo: "ab", prioridad: "media" })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_TITLE");
  });

  it("rechaza completada no booleana al actualizar", () => {
    const error = capturarAppErrorSync(() => validarActualizarTarea({ completada: "si" }));

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_COMPLETADA");
  });

  it("valida el id como entero positivo", () => {
    expect(() => validarIdTarea(-3)).toThrow();
    expect(validarIdTarea(12)).toBe(12);
  });

  // === Nuevos casos de validación: entradas hostiles ===

  it("rechaza proyectoId no entero (string) con 422 INVALID_PROJECT", () => {
    const error = capturarAppErrorSync(() =>
      validarCrearTarea({ proyectoId: "1" as unknown as number, titulo: "Tarea válida", prioridad: "media" })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_PROJECT");
  });

  it("rechaza proyectoId no entero (1.5) con 422 INVALID_PROJECT", () => {
    const error = capturarAppErrorSync(() =>
      validarCrearTarea({ proyectoId: 1.5, titulo: "Tarea válida", prioridad: "media" })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_PROJECT");
  });

  it("rechaza 400 INVALID_BODY cuando el cuerpo es null", () => {
    const error = capturarAppErrorSync(() => validarCrearTarea(null));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("rechaza 400 INVALID_BODY cuando el cuerpo es un array", () => {
    const error = capturarAppErrorSync(() => validarCrearTarea([]));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("validarActualizarTarea rechaza prioridad inválida con 422 INVALID_PRIORITY", () => {
    const error = capturarAppErrorSync(() => validarActualizarTarea({ prioridad: "urgente" as unknown as string }));

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_PRIORITY");
  });

  it("validarActualizarTarea rechaza titulo corto con 422 INVALID_TITLE", () => {
    const error = capturarAppErrorSync(() => validarActualizarTarea({ titulo: "ab" }));

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_TITLE");
  });

  it("validarActualizarTarea rechaza cuerpo null con 400 INVALID_BODY", () => {
    const error = capturarAppErrorSync(() => validarActualizarTarea(null));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("validarActualizarTarea rechaza cuerpo array con 400 INVALID_BODY", () => {
    const error = capturarAppErrorSync(() => validarActualizarTarea([]));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("validarActualizarTarea acepta actualización parcial válida", () => {
    expect(validarActualizarTarea({ titulo: "Nuevo titulo" })).toEqual({ titulo: "Nuevo titulo" });
    expect(validarActualizarTarea({ prioridad: "alta" })).toEqual({ prioridad: "alta" });
    expect(validarActualizarTarea({ completada: true })).toEqual({ completada: true });
  });

  it("validarIdTarea rechaza 400 para 0, -1, 1.5", () => {
    for (const valor of [0, -1, 1.5]) {
      const error = capturarAppErrorSync(() => validarIdTarea(valor));
      expect(error.status).toBe(400);
      expect(error.code).toBe("INVALID_ID");
    }
  });

  it("validarIdTarea rechaza string no entero '1.5' y 'abc'", () => {
    for (const valor of ["1.5", "abc"]) {
      const error = capturarAppErrorSync(() => validarIdTarea(valor));
      expect(error.status).toBe(400);
      expect(error.code).toBe("INVALID_ID");
    }
  });

  it("validarIdTarea acepta 8 y lo devuelve", () => {
    expect(validarIdTarea(8)).toBe(8);
    expect(validarIdTarea("8")).toBe(8);
  });

  it("rechaza titulo solo espacios con 422 INVALID_TITLE", () => {
    const error = capturarAppErrorSync(() =>
      validarCrearTarea({ proyectoId: 1, titulo: "   ", prioridad: "baja" })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_TITLE");
  });
});