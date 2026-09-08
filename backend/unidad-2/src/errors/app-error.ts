/**
 * Error de aplicación: normaliza las respuestas de error de toda la API.
 *
 * Al lanzar `AppError` en cualquier capa (service, repository, controller) el
 * middleware `errorHandler` de `middlewares/error-handler.ts` lo traduce a la
 * estructura uniforme `{ error: { code, message, details } }` con el código de
 * estado correspondiente.
 *
 * Nota: no se usan *parameter properties* de TypeScript (ej. `constructor(
 * public readonly status: number)`) porque el proyecto ejecuta TypeScript
 * directamente con Node en modo "strip-only", que no las soporta.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
