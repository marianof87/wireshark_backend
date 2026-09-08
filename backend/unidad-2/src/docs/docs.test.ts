import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { levantarApp, type AppDePrueba } from "../test/app-de-prueba.ts";

/**
 * Pruebas de la documentación interactiva: Swagger UI en `/api/v1/docs` y el
 * contrato OpenAPI en `/api/v1/docs/openapi.yaml`.
 *
 * Fase RED: estas rutas no existen hoy, así que cada caso falla con 404 hasta
 * que se monte el router de documentación.
 */
describe("Documentación · /api/v1/docs (Swagger UI + OpenAPI)", () => {
  let ctx: AppDePrueba;

  afterEach(async () => {
    await ctx?.cerrar();
  });

  it("GET /api/v1/docs responde 200 con HTML de Swagger UI", async () => {
    ctx = await levantarApp();

    // /api/v1/docs (sin slash final) redirige 301 a /api/v1/docs/; supertest sigue el redirect.
    const res = await request(ctx.app).get("/api/v1/docs").redirects(1);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/i);
    expect(res.text.toLowerCase()).toContain("swagger-ui");
  });

  it("GET /api/v1/docs/openapi.yaml responde 200 con content-type yaml y spec mínimo", async () => {
    ctx = await levantarApp();

    const res = await request(ctx.app).get("/api/v1/docs/openapi.yaml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/yaml/i);
    expect(res.text).toContain("openapi:");
    expect(res.text).toContain("info:");
    expect(res.text).toContain("paths:");
  });

  it("GET /api/v1/docs/openapi.yaml contiene title y version del contrato", async () => {
    ctx = await levantarApp();

    const res = await request(ctx.app).get("/api/v1/docs/openapi.yaml");

    expect(res.status).toBe(200);
    expect(res.text).toContain("API CRUD - Proyectos y Tareas");
    expect(res.text).toContain("2.0.0");
  });

  it("GET /api/v1/docs/ con slash final también resuelve (redirect o 200)", async () => {
    ctx = await levantarApp();

    const res = await request(ctx.app).get("/api/v1/docs/");

    // swagger-ui-express puede responder 200 o redirigir; ambas son correctas.
    expect([200, 301, 308]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text.toLowerCase()).toContain("swagger-ui");
    } else {
      expect(res.headers.location).toMatch(/\/api\/v1\/docs\/?/);
    }
  });
});