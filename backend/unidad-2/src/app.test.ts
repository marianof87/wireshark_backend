import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { levantarApp, type AppDePrueba } from "./test/app-de-prueba.ts";

/**
 * Pruebas de la aplicación como conjunto: salud, contrato de error uniforme y
 * 404 para rutas desconocidas.
 */
describe("Aplicación · base /api/v1 (SQLite)", () => {
  let ctx: AppDePrueba;

  afterEach(async () => {
    await ctx?.cerrar();
  });

  it("GET /api/v1/salud responde 200 con estado ok", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/salud");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "ok" });
  });

  it("una ruta desconocida responde 404 con la estructura de error uniforme", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/api/v1/inexistente");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "Recurso no encontrado", details: [] }
    });
  });

  it("una ruta desconocida (no versionada) también responde 404", async () => {
    ctx = await levantarApp();
    const res = await request(ctx.app).get("/ruta-inexistente");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
