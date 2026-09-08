import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { levantarApp, type AppDePrueba } from "../test/app-de-prueba.ts";

/**
 * Pruebas de integración del CRUD de tareas por HTTP sobre SQLite `:memory:`.
 * Antes de crear tareas se crea un proyecto, porque una tarea siempre pertenece
 * a un proyecto (relación 1 → N con clave foránea).
 */
describe("CRUD Tareas · /api/v1/tareas (SQLite)", () => {
  let ctx: AppDePrueba;

afterEach(async () => {
    await ctx?.cerrar();
  });

  async function sembrarProyecto(nombre = "Proyecto Alpha"): Promise<number> {
    const res = await request(ctx.app)
      .post("/api/v1/proyectos")
      .send({ nombre });
    return res.body.data.id as number;
  }

  it("POST /api/v1/tareas crea una tarea y responde 201", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();

    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .send({ proyectoId, titulo: "Diseñar API", prioridad: "alta" });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe("/api/v1/tareas/1");
    expect(res.body.data).toMatchObject({
      id: 1,
      proyectoId,
      titulo: "Diseñar API",
      prioridad: "alta",
      completada: false
    });
  });

  it("GET /api/v1/tareas/:id devuelve la tarea por Id (búsqueda por Id)", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    const creada = await request(ctx.app)
      .post("/api/v1/tareas")
      .send({ proyectoId, titulo: "Tarea buscada", prioridad: "media" });

    const res = await request(ctx.app).get(`/api/v1/tareas/${creada.body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ titulo: "Tarea buscada", prioridad: "media" });
  });

  it("GET /api/v1/tareas/:id responde 404 si no existe", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/tareas/999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("POST /api/v1/tareas responde 422 si la prioridad no es válida", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();

    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .send({ proyectoId, titulo: "Tarea", prioridad: "urgente" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_PRIORITY");
  });

  it("POST /api/v1/tareas responde 404 si el proyecto no existe", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .send({ proyectoId: 999, titulo: "Tarea huérfana", prioridad: "baja" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("PATCH /api/v1/tareas/:id marca la tarea como completada", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Pendiente", prioridad: "media" });

    const res = await request(ctx.app).patch("/api/v1/tareas/1").send({ completada: true });

    expect(res.status).toBe(200);
    expect(res.body.data.completada).toBe(true);
  });

  it("GET /api/v1/tareas filtra por completada y pagina con meta", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Pendiente A", prioridad: "alta" });
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Pendiente B", prioridad: "media" });
    await request(ctx.app).patch("/api/v1/tareas/1").send({ completada: true });

    const pendientes = await request(ctx.app).get("/api/v1/tareas?completada=false");
    expect(pendientes.status).toBe(200);
    expect(pendientes.body.data).toHaveLength(1);
    expect(pendientes.body.meta).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
  });

  it("DELETE /api/v1/tareas/:id elimina y responde 204", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Borra", prioridad: "baja" });

    const res = await request(ctx.app).delete("/api/v1/tareas/1");

    expect(res.status).toBe(204);
    const despues = await request(ctx.app).get("/api/v1/tareas/1");
    expect(despues.status).toBe(404);
  });

  it("eliminar un proyecto elimina sus tareas en cascada (FK)", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Hija", prioridad: "media" });

    await request(ctx.app).delete(`/api/v1/proyectos/${proyectoId}`);

    const lista = await request(ctx.app).get("/api/v1/tareas");
    expect(lista.body.data).toHaveLength(0);
  });

  // === Nuevos casos XP: validaciones, reemplazo, filtros y paginación ===

  it("POST /api/v1/tareas responde 422 si proyectoId no es entero (string abc)", async () => {
    ctx = await levantarApp();
    await sembrarProyecto();

    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .send({ proyectoId: "abc", titulo: "Tarea", prioridad: "media" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_PROJECT");
  });

  it("POST /api/v1/tareas responde 422 si proyectoId es 1.5", async () => {
    ctx = await levantarApp();
    await sembrarProyecto();

    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .send({ proyectoId: 1.5, titulo: "Tarea", prioridad: "media" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_PROJECT");
  });

  it("POST /api/v1/tareas responde 400 si el cuerpo no es objeto (array)", async () => {
    ctx = await levantarApp();
    await sembrarProyecto();

    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .set("Content-Type", "application/json")
      .send(JSON.stringify([]));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BODY");
  });

  it("POST /api/v1/tareas responde 400 si el cuerpo es string JSON", async () => {
    ctx = await levantarApp();

    const res = await request(ctx.app)
      .post("/api/v1/tareas")
      .set("Content-Type", "text/plain")
      .send("texto");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BODY");
  });

  it("PUT /api/v1/tareas/:id actualiza una tarea existente", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Original", prioridad: "media" });

    const res = await request(ctx.app)
      .put("/api/v1/tareas/1")
      .send({ titulo: "Actualizada", prioridad: "alta", completada: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, titulo: "Actualizada", prioridad: "alta", completada: true });
  });

  it("PUT /api/v1/tareas/:id responde 404 si no existe", async () => {
    ctx = await levantarApp();

    const res = await request(ctx.app)
      .put("/api/v1/tareas/999")
      .send({ titulo: "No existe", prioridad: "baja" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("DELETE /api/v1/tareas/:id responde 404 si no existe", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).delete("/api/v1/tareas/999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("PATCH /api/v1/tareas/:id responde 422 si la prioridad no es válida", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Base", prioridad: "media" });

    const res = await request(ctx.app).patch("/api/v1/tareas/1").send({ prioridad: "urgente" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_PRIORITY");
  });

  it("GET /api/v1/tareas con q filtra por título (búsqueda textual)", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Diseñar API", prioridad: "alta" });
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Escribir docs", prioridad: "baja" });

    const res = await request(ctx.app).get("/api/v1/tareas?q=Diseñar");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].titulo).toBe("Diseñar API");
    expect(res.body.meta).toMatchObject({ total: 1 });
  });

  it("GET /api/v1/tareas con q case-insensitive filtra correctamente", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Maquetar login", prioridad: "media" });

    const res = await request(ctx.app).get("/api/v1/tareas?q=LOGIN");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("GET /api/v1/tareas por defecto limita a 50 y expone meta", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Unica", prioridad: "media" });

    const res = await request(ctx.app).get("/api/v1/tareas");

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
    expect(typeof res.body.meta.page).toBe("number");
    expect(typeof res.body.meta.limit).toBe("number");
    expect(typeof res.body.meta.total).toBe("number");
    expect(typeof res.body.meta.totalPages).toBe("number");
  });

  it("GET /api/v1/tareas con limit >100 se recorta a 100", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Tarea", prioridad: "baja" });

    const res = await request(ctx.app).get("/api/v1/tareas?limit=200");

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(100);
    expect(res.body.meta.page).toBe(1);
  });

  it("GET /api/v1/tareas con page 0 se normaliza a 1", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Tarea", prioridad: "baja" });

    const res = await request(ctx.app).get("/api/v1/tareas?page=0");

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });

  it("GET /api/v1/tareas con page negativa se normaliza a 1", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Tarea", prioridad: "baja" });

    const res = await request(ctx.app).get("/api/v1/tareas?page=-5");

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });

  it("GET /api/v1/tareas verifica contrato meta { page, limit, total, totalPages }", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Tarea A", prioridad: "alta" });
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Tarea B", prioridad: "media" });
const res = await request(ctx.app).get("/api/v1/tareas?limit=1&page=2");

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(res.body.data).toHaveLength(1);
  });

  it("PATCH con titulo corto responde 422 INVALID_TITLE", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Valido", prioridad: "media" });

    const res = await request(ctx.app).patch("/api/v1/tareas/1").send({ titulo: "ab" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_TITLE");
  });

it("GET /api/v1/tareas/:id con id inválido responde 400 INVALID_ID", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/tareas/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ID");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("PUT responde 404 TASK_NOT_FOUND si la tarea se elimina entre medias (P2025)", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Carrera", prioridad: "media" });
    // Borrado directo por Prisma: simula la ventana TOCTOU entre buscarPorId y update
    await ctx.prisma.tarea.delete({ where: { id: 1 } });

    const res = await request(ctx.app).put("/api/v1/tareas/1").send({ titulo: "Nuevo", prioridad: "alta" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("DELETE responde 404 TASK_NOT_FOUND si la tarea ya no existe (P2025)", async () => {
    ctx = await levantarApp();
    const proyectoId = await sembrarProyecto();
    await request(ctx.app).post("/api/v1/tareas").send({ proyectoId, titulo: "Carrera", prioridad: "media" });
    await ctx.prisma.tarea.delete({ where: { id: 1 } });

    const res = await request(ctx.app).delete("/api/v1/tareas/1");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("GET responde 400 INVALID_QUERY si proyectoId no es numérico", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/tareas?proyectoId=abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
  });

  it("GET responde 400 INVALID_QUERY si proyectoId no es entero positivo", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/tareas?proyectoId=-5");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QUERY");
  });

  it("GET responde 400 INVALID_QUERY si page o limit no son numéricos", async () => {
    ctx = await levantarApp();
    const page = await request(ctx.app).get("/api/v1/tareas?page=abc");
    const limit = await request(ctx.app).get("/api/v1/tareas?limit=1.5x");

    expect(page.status).toBe(400);
    expect(page.body.error.code).toBe("INVALID_QUERY");
    expect(limit.status).toBe(400);
    expect(limit.body.error.code).toBe("INVALID_QUERY");
  });
});


