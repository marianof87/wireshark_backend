import { Router } from "express";
import { TareasController } from "./tareas.controller.ts";
import { TareasService } from "./tareas.service.ts";
import type { RepositorioTareas } from "./tareas.repository.ts";
import type { RepositorioProyectos } from "../proyectos/proyectos.repository.ts";

/**
 * Router de tareas.
 *
 * El servicio de tareas necesita también el repositorio de proyectos para
 * verificar que la tarea pertenece a un proyecto existente: ambas dependencias
 * se inyectan desde afuera.
 */
export function crearTareasRouter(
  tareasRepository: RepositorioTareas,
  proyectosRepository: RepositorioProyectos
): Router {
  const router = Router();
  const controller = new TareasController(new TareasService(tareasRepository, proyectosRepository));

  router.get("/", controller.listar);
  router.get("/:id", controller.buscarPorId);
  router.post("/", controller.crear);
  router.put("/:id", controller.reemplazar);
  router.patch("/:id", controller.modificarParcial);
  router.delete("/:id", controller.eliminar);

  return router;
}
