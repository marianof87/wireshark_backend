import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.ts";

/**
 * Middleware de ruta no encontrada.
 *
 * Se monta después de todas las rutas: cualquier solicitud que no haya
 * coincidido con un `router` se responde con 404 y la estructura de error
 * uniforme del contrato.
 */
export const notFound: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, "NOT_FOUND", "Recurso no encontrado"));
};
