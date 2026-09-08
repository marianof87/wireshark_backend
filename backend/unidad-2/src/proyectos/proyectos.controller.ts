import type { Request, Response } from "express";
import { ProyectosService, validarCrearProyecto, validarActualizarProyecto, validarIdProyecto } from "./proyectos.service.ts";

/**
 * Controlador de proyectos: traduce HTTP a llamadas de aplicación y construye
 * las respuestas. No contiene reglas de negocio ni SQL. Los handlers son
 * asíncronos: Express 5 propaga los rechazos al `errorHandler` central.
 */
export class ProyectosController {
  private readonly service: ProyectosService;

  constructor(service: ProyectosService) {
    this.service = service;
  }

  /** GET /api/v1/proyectos · listado. */
  listar = async (_request: Request, response: Response): Promise<void> => {
    response.status(200).json({ data: await this.service.obtenerTodas() });
  };

  /** GET /api/v1/proyectos/:id · búsqueda por Id. */
  buscarPorId = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdProyecto(request.params.id);
    response.status(200).json({ data: await this.service.buscarPorId(id) });
  };

  /** POST /api/v1/proyectos */
  crear = async (request: Request, response: Response): Promise<void> => {
    const dto = validarCrearProyecto(request.body);
    const proyecto = await this.service.crear(dto);
    response
      .location(`/api/v1/proyectos/${proyecto.id}`)
      .status(201)
      .json({ data: proyecto });
  };

  /** PUT /api/v1/proyectos/:id · reemplazo completo. */
  reemplazar = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdProyecto(request.params.id);
    const dto = validarActualizarProyecto(request.body);
    response.status(200).json({ data: await this.service.reemplazar(id, dto) });
  };

  /** PATCH /api/v1/proyectos/:id · modificación parcial. */
  modificarParcial = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdProyecto(request.params.id);
    const dto = validarActualizarProyecto(request.body);
    response.status(200).json({ data: await this.service.modificarParcial(id, dto) });
  };

  /** DELETE /api/v1/proyectos/:id */
  eliminar = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdProyecto(request.params.id);
    await this.service.eliminar(id);
    response.status(204).send();
  };
}