import { describe, it, expect } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { AppError } from "../errors/app-error.ts";
import { errorHandler } from "./error-handler.ts";

/**
 * Pruebas unitarias del manejador central de errores.
 *
 * Se monta una app mínima con un endpoint que lanza distintos tipos de error,
 * y luego la función `errorHandler` como middleware de error. Esto aísla el
 * contrato de error uniforme sin depender de la aplicación completa.
 */
function levantarConError(disparador: (request: Request, response: Response) => void) {
  const app = express();
  app.get("/boom", (request, response) => disparador(request, response));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(errorHandler as (err: unknown, req: Request, res: Response, next: NextFunction) => void);
  return app;
}

describe("errorHandler", () => {
  it("traduce un AppError a la estructura uniforme con su estado y código", async () => {
    const app = levantarConError(() => {
      throw new AppError(409, "CONFLICT", "El recurso ya existe", [{ campo: "nombre" }]);
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "El recurso ya existe",
        details: [{ campo: "nombre" }]
      }
    });
  });

  it("traduce una excepción cualquiera a 500 INTERNAL_ERROR, sin filtrar trazas", async () => {
    const app = levantarConError(() => {
      throw new Error("fallo inesperado interno");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Ocurrió un error interno", details: [] }
    });
  });

  it("un error HTTP de cliente (status 4xx, p.ej. JSON malformado de body-parser) responde 400 INVALID_BODY", async () => {
    const app = levantarConError(() => {
      // body-parser lanza errores con status, type y expose; reproducimos el
      // forma que llega por la red cuando el JSON está malformado.
      const error = new SyntaxError("Unexpected token") as SyntaxError & {
        status: number;
        type: string;
        body: unknown;
      };
      error.status = 400;
      error.type = "entity.parse.failed";
      error.body = undefined;
      throw error;
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "INVALID_BODY", message: "El cuerpo de la petición no es válido", details: [] }
    });
  });
});
