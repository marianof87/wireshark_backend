import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.ts";
import { TareasService, validarCrearTarea, validarActualizarTarea, validarIdTarea } from "./tareas.service.ts";

/**
 * Convierte un parámetro de consulta a número.
 *
 * Acepta valores numéricos (incluido el 0 y negativos, que luego normalizan
 * `page` y `limit`), pero rechaza con 400 `INVALID_QUERY` los que no son
 * numéricos (`abc`, `1.5abc`, arrays...), en lugar de dejar pasar `NaN`.
 */
function numeroDeConsulta(valor: unknown, nombre: string): number | undefined {
  if (valor === undefined) {
    return undefined;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw new AppError(400, "INVALID_QUERY", `El parámetro ${nombre} debe ser un número`);
  }
  return numero;
}

/**
 * Controlador de tareas.
 *
 * Además de traducir HTTP, normaliza los parámetros de consulta del listado:
 * filtros (`proyectoId`, `completada`, `q`) y paginación simple con `page` y
 * `limit` (valores por defecto y límite máximo de 100).
 */
export class TareasController {
  private readonly service: TareasService;

  constructor(service: TareasService) {
    this.service = service;
  }

  /** GET /api/v1/tareas?page=&limit=&proyectoId=&completada=&q= */
  listar = async (request: Request, response: Response): Promise<void> => {
    const page = Math.max(numeroDeConsulta(request.query.page, "page") ?? 1, 1);
    const limit = Math.min(Math.max(numeroDeConsulta(request.query.limit, "limit") ?? 50, 1), 100);

    let completada: boolean | undefined;
    if (request.query.completada !== undefined) {
      completada = request.query.completada === "true";
    }

    let proyectoId: number | undefined;
    if (request.query.proyectoId !== undefined) {
      const numero = numeroDeConsulta(request.query.proyectoId, "proyectoId");
      if (numero === undefined || !Number.isInteger(numero) || numero <= 0) {
        throw new AppError(400, "INVALID_QUERY", "El parámetro proyectoId debe ser un entero positivo");
      }
      proyectoId = numero;
    }

    const todas = await this.service.obtenerTodas({
      proyectoId,
      completada,
      q: typeof request.query.q === "string" ? request.query.q : undefined
    });

    const total = todas.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const inicio = (page - 1) * limit;
    const datos = todas.slice(inicio, inicio + limit);

    response.status(200).json({ data: datos, meta: { page, limit, total, totalPages } });
  };

  /** GET /api/v1/tareas/:id · búsqueda por Id. */
  buscarPorId = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdTarea(request.params.id);
    response.status(200).json({ data: await this.service.buscarPorId(id) });
  };

  /** POST /api/v1/tareas */
  crear = async (request: Request, response: Response): Promise<void> => {
    const dto = validarCrearTarea(request.body);
    const tarea = await this.service.crear(dto);
    response
      .location(`/api/v1/tareas/${tarea.id}`)
      .status(201)
      .json({ data: tarea });
  };

  /** PUT /api/v1/tareas/:id · reemplazo completo. */
  reemplazar = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdTarea(request.params.id);
    const dto = validarActualizarTarea(request.body);
    response.status(200).json({ data: await this.service.reemplazar(id, dto) });
  };

  /** PATCH /api/v1/tareas/:id · modificación parcial. */
  modificarParcial = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdTarea(request.params.id);
    const dto = validarActualizarTarea(request.body);
    response.status(200).json({ data: await this.service.modificarParcial(id, dto) });
  };

  /** DELETE /api/v1/tareas/:id */
  eliminar = async (request: Request, response: Response): Promise<void> => {
    const id = validarIdTarea(request.params.id);
    await this.service.eliminar(id);
    response.status(204).send();
  };
}