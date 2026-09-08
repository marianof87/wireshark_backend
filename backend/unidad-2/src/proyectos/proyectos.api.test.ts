import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { levantarApp, type AppDePrueba } from "../test/app-de-prueba.ts";

/**
 * Pruebas de integración del CRUD de proyectos por HTTP, corriendo sobre una
 * base SQLite real en `:memory:` (no se usa ningún mock de la base aquí).
 * Verifican ruta, método, cuerpo y código de estado de extremo a extremo:
 *   HTTP → Router → Controller → Service → Repository → SQLite.
 */
describe("CRUD Proyectos · /api/v1/proyectos (SQLite)", () => {
  let ctx: AppDePrueba;

afterEach(async () => {
    await ctx?.cerrar();
  });

  it("GET /api/v1/proyectos devuelve una colección vacía al inicio", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/proyectos");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });

  it("POST /api/v1/proyectos crea y responde 201 con Location", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app)
      .post("/api/v1/proyectos")
      .send({ nombre: "Proyecto Alpha", descripcion: "Primer proyecto" });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe("/api/v1/proyectos/1");
    expect(res.body.data).toMatchObject({ id: 1, nombre: "Proyecto Alpha", descripcion: "Primer proyecto" });
    expect(typeof res.body.data.fechaCreacion).toBe("string");
  });

  it("GET /api/v1/proyectos/:id devuelve el proyecto por Id (búsqueda por Id)", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Alpha" });

    const res = await request(ctx.app).get("/api/v1/proyectos/1");

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, nombre: "Alpha" });
  });

  it("GET /api/v1/proyectos/:id responde 404 si no existe", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/proyectos/999");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "PROJECT_NOT_FOUND", message: "El proyecto solicitado no existe", details: [] }
    });
  });

  it("GET /api/v1/proyectos/:id responde 400 si el id no es válido", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/proyectos/abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ID");
  });

  it("PUT /api/v1/proyectos/:id reemplaza el recurso", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Viejo" });

    const res = await request(ctx.app)
      .put("/api/v1/proyectos/1")
      .send({ nombre: "Nuevo nombre", descripcion: "Nueva descripción" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1, nombre: "Nuevo nombre", descripcion: "Nueva descripción" });
  });

  it("PATCH /api/v1/proyectos/:id modifica un solo campo", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Alpha", descripcion: "Original" });

    const res = await request(ctx.app).patch("/api/v1/proyectos/1").send({ descripcion: "Modificada" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nombre: "Alpha", descripcion: "Modificada" });
  });

  it("DELETE /api/v1/proyectos/:id elimina y responde 204", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Borra" });

    const res = await request(ctx.app).delete("/api/v1/proyectos/1");

    expect(res.status).toBe(204);
    const despues = await request(ctx.app).get("/api/v1/proyectos/1");
    expect(despues.status).toBe(404);
  });

  it("POST /api/v1/proyectos responde 422 si falta el nombre", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).post("/api/v1/proyectos").send({ descripcion: "sin nombre" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_NAME");
  });

  it("POST con cuerpo JSON malformado responde 400 INVALID_BODY, no 500", async () => {
    ctx = await levantarApp();
    // Este caso capturó un defecto en la fase RED del ciclo TDD: antes el
    // error de parseo de body-parser terminaba como 500 INTERNAL_ERROR.
    const res = await request(ctx.app)
      .post("/api/v1/proyectos")
      .set("Content-Type", "application/json")
      .send('{"nombre": "cuerpo roto');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "INVALID_BODY", message: "El cuerpo de la petición no es válido", details: [] }
    });
  });

  // === Nuevos casos XP: entradas hostiles, contratos y flujos de error ===

  it("POST /api/v1/proyectos responde 400 INVALID_BODY si el cuerpo es un array", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app)
      .post("/api/v1/proyectos")
      .set("Content-Type", "application/json")
      .send(JSON.stringify([]));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BODY");
    expect(res.body.error.details).toEqual([]);
    expect(typeof res.body.error.message).toBe("string");
  });

  it("POST /api/v1/proyectos responde 400 INVALID_BODY si el cuerpo es un string JSON", async () => {
    ctx = await levantarApp();
    // Enviar como text/plain evita el SyntaxError de body-parser strict y llega al validador como texto
    const res = await request(ctx.app)
      .post("/api/v1/proyectos")
      .set("Content-Type", "text/plain")
      .send("texto");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_BODY");
  });

  it("POST /api/v1/proyectos responde 422 INVALID_DESCRIPTION si descripcion no es string", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app)
      .post("/api/v1/proyectos")
      .send({ nombre: "Nombre válido", descripcion: 123 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_DESCRIPTION");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("DELETE /api/v1/proyectos/:id responde 404 si no existe", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).delete("/api/v1/proyectos/999");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(res.body.error).toEqual(
      expect.objectContaining({ code: expect.any(String), message: expect.any(String), details: expect.any(Array) })
    );
  });

  it("PUT /api/v1/proyectos/:id responde 404 si no existe", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app)
      .put("/api/v1/proyectos/999")
      .send({ nombre: "No existe", descripcion: "Nada" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("PATCH /api/v1/proyectos/:id responde 422 si el nombre es inválido", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Valido" });

    const res = await request(ctx.app).patch("/api/v1/proyectos/1").send({ nombre: "ab" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_NAME");
  });

  it("verifica contrato de error uniforme { error: { code, message, details } }", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/proyectos/abc");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "INVALID_ID");
    expect(res.body.error).toHaveProperty("message", expect.any(String));
    expect(res.body.error).toHaveProperty("details");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it("PATCH con nombre solo espacios responde 422 INVALID_NAME", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Base" });

    const res = await request(ctx.app).patch("/api/v1/proyectos/1").send({ nombre: "   " });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_NAME");
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

it("POST con nombre solo espacios responde 422 INVALID_NAME", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "   " });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_NAME");
  });

  it("PUT responde 404 PROJECT_NOT_FOUND si el proyecto se elimina entre medias (P2025)", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Carrera" });
    // Borrado directo por Prisma: simula la ventana TOCTOU entre buscarPorId y update
    await ctx.prisma.proyecto.delete({ where: { id: 1 } });

    const res = await request(ctx.app).put("/api/v1/proyectos/1").send({ nombre: "Nuevo" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("DELETE responde 404 PROJECT_NOT_FOUND si el proyecto ya no existe (P2025)", async () => {
    ctx = await levantarApp();
    await request(ctx.app).post("/api/v1/proyectos").send({ nombre: "Carrera" });
    await ctx.prisma.proyecto.delete({ where: { id: 1 } });

    const res = await request(ctx.app).delete("/api/v1/proyectos/1");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PROJECT_NOT_FOUND");
  });
});
