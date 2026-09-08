import { Router } from "express";
import { ProyectosController } from "./proyectos.controller.ts";
import { ProyectosService } from "./proyectos.service.ts";
import type { RepositorioProyectos } from "./proyectos.repository.ts";

/**
 * Router: relaciona métodos y rutas con los métodos del controlador.
 *
 * La inyección fluye de afuera hacia adentro: el router recibe el repositorio,
 * construye servicio y controlador, y monta las rutas.
 */
export function crearProyectosRouter(repository: RepositorioProyectos): Router {
  const router = Router();
  const controller = new ProyectosController(new ProyectosService(repository));

  router.get("/", controller.listar);
  router.get("/:id", controller.buscarPorId);
  router.post("/", controller.crear);
  router.put("/:id", controller.reemplazar);
  router.patch("/:id", controller.modificarParcial);
  router.delete("/:id", controller.eliminar);

  return router;
}
