import { AppError } from "../errors/app-error.ts";
import type { RepositorioProyectos } from "../proyectos/proyectos.repository.ts";
import type { Tarea, CrearTareaDto, ActualizarTareaDto, Prioridad } from "./tarea.ts";
import { PRIORIDADES } from "./tarea.ts";
import type { RepositorioTareas } from "./tareas.repository.ts";

export function validarCrearTarea(datos: unknown): CrearTareaDto {
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
    throw new AppError(400, "INVALID_BODY", "El cuerpo debe ser un objeto JSON");
  }

  const objeto = datos as Record<string, unknown>;

  if (!Number.isInteger(objeto.proyectoId)) {
    throw new AppError(422, "INVALID_PROJECT", "El campo proyectoId debe ser un número entero");
  }

  if (typeof objeto.titulo !== "string" || objeto.titulo.trim().length < 3) {
    throw new AppError(422, "INVALID_TITLE", "El título debe tener al menos tres caracteres");
  }

  if (typeof objeto.prioridad !== "string" || !PRIORIDADES.includes(objeto.prioridad as Prioridad)) {
    throw new AppError(422, "INVALID_PRIORITY", "La prioridad no es válida");
  }

  return {
    proyectoId: objeto.proyectoId as number,
    titulo: objeto.titulo.trim(),
    prioridad: objeto.prioridad as Prioridad
  };
}

export function validarActualizarTarea(datos: unknown): ActualizarTareaDto {
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
    throw new AppError(400, "INVALID_BODY", "El cuerpo debe ser un objeto JSON");
  }

  const objeto = datos as Record<string, unknown>;
  const parcial: ActualizarTareaDto = {};

  if (objeto.titulo !== undefined) {
    if (typeof objeto.titulo !== "string" || objeto.titulo.trim().length < 3) {
      throw new AppError(422, "INVALID_TITLE", "El título debe tener al menos tres caracteres");
    }
    parcial.titulo = objeto.titulo.trim();
  }

  if (objeto.prioridad !== undefined) {
    if (typeof objeto.prioridad !== "string" || !PRIORIDADES.includes(objeto.prioridad as Prioridad)) {
      throw new AppError(422, "INVALID_PRIORITY", "La prioridad no es válida");
    }
    parcial.prioridad = objeto.prioridad as Prioridad;
  }

  if (objeto.completada !== undefined) {
    if (typeof objeto.completada !== "boolean") {
      throw new AppError(422, "INVALID_COMPLETADA", "El campo completada debe ser booleano");
    }
    parcial.completada = objeto.completada;
  }

  return parcial;
}

export function validarIdTarea(id: unknown): number {
  const numero = Number.isInteger(id) ? (id as number) : Number(id);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new AppError(400, "INVALID_ID", "El identificador no es válido");
  }

  return numero;
}

/**
 * Servicio de tareas.
 *
 * Regla de negocio: una tarea sólo puede pertenecer a un proyecto existente, y
 * el `proyectoId` no se reasigna en una actualización. Métodos asíncronos para
 * poder trabajar contra el repositorio Prisma o contra un mock.
 */
export class TareasService {
  private readonly repository: RepositorioTareas;
  private readonly proyectos: RepositorioProyectos;

  constructor(repository: RepositorioTareas, proyectos: RepositorioProyectos) {
    this.repository = repository;
    this.proyectos = proyectos;
  }

  private async verificarProyecto(proyectoId: number): Promise<void> {
    if ((await this.proyectos.buscarPorId(proyectoId)) === undefined) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "El proyecto de la tarea no existe");
    }
  }

  async crear(dto: CrearTareaDto): Promise<Tarea> {
    await this.verificarProyecto(dto.proyectoId);
    const tarea: Tarea = {
      id: 0, // el repositorio asigna el id real
      proyectoId: dto.proyectoId,
      titulo: dto.titulo,
      prioridad: dto.prioridad,
      completada: false,
      fechaCreacion: new Date().toISOString()
    };
    return this.repository.guardar(tarea);
  }

  async obtenerTodas(filtro?: { proyectoId?: number; completada?: boolean; q?: string }): Promise<Tarea[]> {
    return this.repository.obtenerTodas(filtro);
  }

  async buscarPorId(id: number): Promise<Tarea> {
    const tarea = await this.repository.buscarPorId(id);
    if (tarea === undefined) {
      throw new AppError(404, "TASK_NOT_FOUND", "La tarea solicitada no existe");
    }
    return tarea;
  }

  async reemplazar(id: number, dto: ActualizarTareaDto): Promise<Tarea> {
    const existente = await this.buscarPorId(id);
    const actualizada: Tarea = {
      ...existente,
      titulo: dto.titulo ?? existente.titulo,
      prioridad: dto.prioridad ?? existente.prioridad,
      completada: dto.completada ?? existente.completada
    };
    // El update devuelve el registro; aquí ya conocemos los campos resultantes.
    // Si el registro desaparece entre la lectura y la escritura (TOCTOU), el
    // repositorio lanza 404 TASK_NOT_FOUND al detectar P2025.
    await this.repository.reemplazar(actualizada);
    return actualizada;
  }

  /** PATCH y PUT de tarea comparten el mismo flujo en este dominio. */
  async modificarParcial(id: number, dto: ActualizarTareaDto): Promise<Tarea> {
    return this.reemplazar(id, dto);
  }

  async eliminar(id: number): Promise<void> {
    await this.buscarPorId(id); // lanza 404 si no existe
    await this.repository.eliminar(id);
  }
}