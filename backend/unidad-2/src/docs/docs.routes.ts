import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
// unidad-2/src/docs → unidad-2/openapi.yaml
const rutaSpec = join(__dirname, "..", "..", "openapi.yaml");

/** Carga y parsea el contrato OpenAPI; se invoca al montar el router (no al importar). */
function cargarEspecificacion(): Record<string, unknown> {
  let contenido: string;
  try {
    contenido = readFileSync(rutaSpec, "utf8");
  } catch (error) {
    throw new Error(`No se pudo leer el contrato OpenAPI en ${rutaSpec}: ${(error as Error).message}`);
  }
  return parse(contenido) as Record<string, unknown>;
}

/**
 * Router de documentación interactiva.
 *
 * - GET /api/v1/docs             → Swagger UI (explorador interactivo).
 * - GET /api/v1/docs/openapi.yaml → el contrato OpenAPI en crudo.
 *
 * Se monta ANTES del middleware `notFound` para que el 404 no lo capture.
 *
 * Guarda de entorno: en `NODE_ENV=production` la documentación interactiva se
 * desactiva (404) para no exponer el mapa completo de la API; en desarrollo y
 * en las pruebas permanece activa.
 */
export function crearDocsRouter(): Router {
  const router = Router();

  if (process.env.NODE_ENV === "production") {
    router.use((_request, response) => {
      response.status(404).send("Not found");
    });
    return router;
  }

  const especificacion = cargarEspecificacion();

  router.use("/", swaggerUi.serve);
  router.get("/", swaggerUi.setup(especificacion));

  router.get("/openapi.yaml", (_request, response) => {
    response.type("application/yaml").send(readFileSync(rutaSpec, "utf8"));
  });

  return router;
}