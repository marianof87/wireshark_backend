import { describe, expect, it, beforeEach } from "vitest";
import { AppError } from "../errors/app-error.ts";
import {
  ProyectosService,
  validarCrearProyecto,
  validarActualizarProyecto,
  validarIdProyecto
} from "./proyectos.service.ts";
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
 * Pruebas unitarias del servicio de proyectos usando un repositorio SIMULADO
 * (datos mock). Verifican las reglas de negocio y el mapeo a AppError sin
 * depender de HTTP ni de Prisma.
 */
describe("ProyectosService (con repositorio mock)", () => {
  let service: ProyectosService;

  beforeEach(() => {
    service = new ProyectosService(crearRepositorioProyectosMock());
  });

  it("crea un proyecto partiendo del mock y le asigna un id nuevo", async () => {
    const creado = await service.crear({ nombre: "Proyecto Gamma", descripcion: "Nuevo" });

    expect(creado.id).toBe(3); // el mock arranca con ids 1 y 2
    expect(creado.nombre).toBe("Proyecto Gamma");
    expect(await service.obtenerTodas()).toHaveLength(3);
  });

  it("busca un proyecto por id existente en el mock", async () => {
    const proyecto = await service.buscarPorId(1);

    expect(proyecto).toMatchObject({ id: 1, nombre: "Proyecto Alpha" });
  });

  it("lanza 404 PROJECT_NOT_FOUND si el id no existe", async () => {
    const error = await capturarAppError(() => service.buscarPorId(999));

    expect(error.status).toBe(404);
    expect(error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("reemplaza (PUT) un proyecto y conserva la fecha de creación", async () => {
    const actualizado = await service.reemplazar(1, {
      nombre: "Proyecto Alpha Renombrado",
      descripcion: "Otra descripción"
    });

    expect(actualizado).toMatchObject({
      id: 1,
      nombre: "Proyecto Alpha Renombrado",
      descripcion: "Otra descripción",
      fechaCreacion: expect.any(String)
    });
  });

  it("lanza 404 al reemplazar un proyecto inexistente", async () => {
    const error = await capturarAppError(() => service.reemplazar(999, { nombre: "Cambio" }));

    expect(error.status).toBe(404);
  });

  it("elimina un proyecto existente", async () => {
    await service.eliminar(1);
    expect((await service.obtenerTodas()).find((p) => p.id === 1)).toBeUndefined();
  });

  it("lanza 404 al eliminar un proyecto inexistente", async () => {
    const error = await capturarAppError(() => service.eliminar(555));

    expect(error.status).toBe(404);
  });

  // === Nuevos casos XP: cobertura de casos límite y contratos ===

  it("obtenerTodas devuelve el listado completo del mock", async () => {
    const todas = await service.obtenerTodas();

    expect(todas).toHaveLength(2);
    expect(todas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, nombre: "Proyecto Alpha" }),
        expect.objectContaining({ id: 2, nombre: "Proyecto Beta" })
      ])
    );
  });

  it("modificarParcial (PATCH) actualiza solo los campos enviados", async () => {
    const actualizado = await service.modificarParcial(1, { nombre: "Alpha Parcheado" });

    expect(actualizado).toMatchObject({ id: 1, nombre: "Alpha Parcheado" });
    expect(actualizado.descripcion).toBe("Sitio web institucional");
    expect(actualizado.fechaCreacion).toBe("2026-08-01T10:00:00.000Z");
  });

  it("reemplazar con solo descripcion conserva el nombre existente", async () => {
    const actualizado = await service.reemplazar(1, { descripcion: "Solo desc" });

    expect(actualizado).toMatchObject({
      id: 1,
      nombre: "Proyecto Alpha",
      descripcion: "Solo desc"
    });
    expect(actualizado.fechaCreacion).toBe("2026-08-01T10:00:00.000Z");
  });

  it("crear sin descripcion deja descripcion vacía", async () => {
    const creado = await service.crear({ nombre: "Sin descripcion" });

    expect(creado).toMatchObject({ nombre: "Sin descripcion", descripcion: "" });
    expect(typeof creado.descripcion).toBe("string");
  });

  it("lanza 404 PROJECT_NOT_FOUND al hacer modificarParcial sobre id inexistente", async () => {
    const error = await capturarAppError(() => service.modificarParcial(999, { nombre: "Inexistente" }));

    expect(error.status).toBe(404);
    expect(error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("lanza 404 PROJECT_NOT_FOUND al reemplazar con id inexistente (verifica code)", async () => {
    const error = await capturarAppError(() => service.reemplazar(888, { nombre: "Otro" }));

    expect(error.status).toBe(404);
    expect(error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("eliminar un id inexistente lanza 404 PROJECT_NOT_FOUND", async () => {
    const error = await capturarAppError(() => service.eliminar(7777));

    expect(error.status).toBe(404);
    expect(error.code).toBe("PROJECT_NOT_FOUND");
  });
});

describe("Validaciones del proyecto", () => {
  it("rechaza 400 INVALID_BODY cuando el cuerpo no es un objeto", () => {
    const error = capturarAppErrorSync(() => validarCrearProyecto("texto"));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("rechaza 422 INVALID_NAME si el nombre es demasiado corto", () => {
    const error = capturarAppErrorSync(() => validarCrearProyecto({ nombre: "ab" }));

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_NAME");
  });

  it("rechaza 400 INVALID_ID si el id no es un entero positivo", () => {
    expect(() => validarIdProyecto("abc")).toThrow();
    expect(() => validarIdProyecto(0)).toThrow();
  });

  it("acepta un id válido y lo devuelve", () => {
    expect(validarIdProyecto("7")).toBe(7);
  });

  it("normaliza una actualización parcial y omite campos ausentes", () => {
    expect(validarActualizarProyecto({ descripcion: "Solo cambia esto" })).toEqual({
      descripcion: "Solo cambia esto"
    });
  });

  // === Nuevos casos de validación: entradas hostiles y límites ===

  it("rechaza 400 INVALID_BODY cuando el cuerpo es null", () => {
    const error = capturarAppErrorSync(() => validarCrearProyecto(null));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("rechaza 400 INVALID_BODY cuando el cuerpo es un array", () => {
    const error = capturarAppErrorSync(() => validarCrearProyecto([]));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("rechaza 422 INVALID_NAME si el nombre son solo espacios", () => {
    const error = capturarAppErrorSync(() => validarCrearProyecto({ nombre: "   " }));

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_NAME");
  });

  it("rechaza 422 INVALID_DESCRIPTION si descripcion no es string", () => {
    const error = capturarAppErrorSync(() =>
      validarCrearProyecto({ nombre: "Nombre válido", descripcion: 123 as unknown as string })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_DESCRIPTION");
  });

  it("validarActualizarProyecto rechaza 422 si nombre es vacío o solo espacios", () => {
    const errorVacio = capturarAppErrorSync(() => validarActualizarProyecto({ nombre: "" }));
    expect(errorVacio.status).toBe(422);
    expect(errorVacio.code).toBe("INVALID_NAME");

    const errorEspacios = capturarAppErrorSync(() => validarActualizarProyecto({ nombre: "   " }));
    expect(errorEspacios.status).toBe(422);
    expect(errorEspacios.code).toBe("INVALID_NAME");
  });

  it("validarActualizarProyecto rechaza 422 si descripcion no es string", () => {
    const error = capturarAppErrorSync(() =>
      validarActualizarProyecto({ descripcion: 999 as unknown as string })
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_DESCRIPTION");
  });

  it("validarActualizarProyecto rechaza 400 si el cuerpo es null", () => {
    const error = capturarAppErrorSync(() => validarActualizarProyecto(null));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("validarActualizarProyecto rechaza 400 si el cuerpo es array", () => {
    const error = capturarAppErrorSync(() => validarActualizarProyecto([]));

    expect(error.status).toBe(400);
    expect(error.code).toBe("INVALID_BODY");
  });

  it("validarIdProyecto rechaza 400 para 0, -5, 1.5, '1.5', undefined, NaN", () => {
    const casos: unknown[] = [0, -5, 1.5, "1.5", undefined, NaN];
    for (const valor of casos) {
      const error = capturarAppErrorSync(() => validarIdProyecto(valor));
      expect(error.status).toBe(400);
      expect(error.code).toBe("INVALID_ID");
    }
  });

  it("validarIdProyecto acepta 10 y lo devuelve", () => {
    expect(validarIdProyecto(10)).toBe(10);
    expect(validarIdProyecto("10")).toBe(10);
  });
});