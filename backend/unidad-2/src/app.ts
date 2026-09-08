import express, { type Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { prisma as prismaSingleton } from "./db/database.ts";
import { crearRepositorioProyectos } from "./proyectos/proyectos.repository.ts";
import { crearProyectosRouter } from "./proyectos/proyectos.routes.ts";
import { crearRepositorioTareas } from "./tareas/tareas.repository.ts";
import { crearTareasRouter } from "./tareas/tareas.routes.ts";
import { crearDocsRouter } from "./docs/docs.routes.ts";
import { errorHandler } from "./middlewares/error-handler.ts";
import { notFound } from "./middlewares/not-found.ts";

export interface OpcionesAplicacion {
  /** Cliente Prisma. En pruebas se inyecta uno aislado sobre una BD temporal. */
  prisma?: PrismaClient;
}

/**
 * Construye la aplicación Express con su arquitectura por capas:
 *
 *   HTTP → Router → Controller → Service → Repository → Prisma (SQLite)
 *
 * Monta los routers bajo el contrato versionado `/api/v1`, la documentación
 * interactiva (Swagger UI) y, al final, los middlewares de 404 y de errores.
 * Devuelve además `prisma` y `cerrar` para que las pruebas puedan terminar el
 * proceso limpiamente.
 */
export function crearAplicacion(opciones: OpcionesAplicacion = {}) {
  const prisma = opciones.prisma ?? prismaSingleton;

  const proyectosRepository = crearRepositorioProyectos(prisma);
  const tareasRepository = crearRepositorioTareas(prisma);

  const app: Express = express();

  app.use(express.json());

  app.get("/api/v1/salud", (_request, response) => {
    response.status(200).json({ estado: "ok", fecha: new Date().toISOString() });
  });

  app.use("/api/v1/proyectos", crearProyectosRouter(proyectosRepository));
  app.use("/api/v1/tareas", crearTareasRouter(tareasRepository, proyectosRepository));
  app.use("/api/v1/docs", crearDocsRouter());

  app.use(notFound);
  app.use(errorHandler);

  return { app, prisma, cerrar: () => prisma.$disconnect() };
}