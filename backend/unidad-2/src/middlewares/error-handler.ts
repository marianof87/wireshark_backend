import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error.ts";

/**
 * Middleware central de errores.
 *
 * Traduce `AppError` a la estructura de error uniforme del contrato.
 *
 * Además trata los errores HTTP nativos del framework (aquellos que exponen un
 * `status` de cliente, como un JSON malformado detectado por body-parser) como
 * respuestas 4xx coherentes, en lugar de convertirlos en un 500. Por último,
 * ante cualquier otra excepción registra la traza y responde 500 sin filtrar al
 * cliente detalles técnicos ni trazas internas. Se monta SIEMPRE al final,
 * después de las rutas.
 *
 * Este comportamiento surgió del ciclo TDD (XP): un test reveló que un cuerpo
 * JSON inválido devolvía 500 en vez de 400 (ver `middlewares/error-handler.test.ts`).
 */
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details }
    });
    return;
  }

  const status = numericStatus(error);
  if (status !== undefined && status >= 400 && status < 500) {
    // Error del cliente (p.ej. JSON malformado de body-parser): responder 400
    // bajo el contrato uniforme, sin contaminar los logs con una traza del 500.
    response.status(status).json({
      error: { code: "INVALID_BODY", message: "El cuerpo de la petición no es válido", details: [] }
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Ocurrió un error interno", details: [] }
  });
};

/** Lee la propiedad `status`/`statusCode` que exponen los errores HTTP nativos. */
function numericStatus(error: unknown): number | undefined {
  const valor = (error as { status?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
  return typeof valor === "number" ? valor : undefined;
}
