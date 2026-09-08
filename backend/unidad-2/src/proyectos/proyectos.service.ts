import { AppError } from "../errors/app-error.ts";
import type { CrearProyectoDto, ActualizarProyectoDto, Proyecto } from "./proyecto.ts";
import type { RepositorioProyectos } from "./proyectos.repository.ts";

/**
 * Validación en tiempo de ejecución del cuerpo recibido por HTTP.
 *
 * TypeScript no reemplaza la validación: `request.body` puede ser cualquier
 * cosa que llegue por la red, así que aquí se comprueba la forma real antes de
 * que el servicio la use.
 */
export function validarCrearProyecto(datos: unknown): CrearProyectoDto {
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
    throw new AppError(400, "INVALID_BODY", "El cuerpo debe ser un objeto JSON");
  }

  const objeto = datos as Record<string, unknown>;

  if (typeof objeto.nombre !== "string" || objeto.nombre.trim().length < 3) {
    throw new AppError(422, "INVALID_NAME", "El nombre debe tener al menos tres caracteres");
  }

  const descripcion = objeto.descripcion;
  if (descripcion !== undefined && typeof descripcion !== "string") {
    throw new AppError(422, "INVALID_DESCRIPTION", "La descripción debe ser texto");
  }

  return {
    nombre: objeto.nombre.trim(),
    descripcion: descripcion === undefined ? "" : descripcion.trim()
  };
}

export function validarActualizarProyecto(datos: unknown): ActualizarProyectoDto {
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
    throw new AppError(400, "INVALID_BODY", "El cuerpo debe ser un objeto JSON");
  }

  const objeto = datos as Record<string, unknown>;
  const parcial: ActualizarProyectoDto = {};

  if (objeto.nombre !== undefined) {
    if (typeof objeto.nombre !== "string" || objeto.nombre.trim().length < 3) {
      throw new AppError(422, "INVALID_NAME", "El nombre debe tener al menos tres caracteres");
    }
    parcial.nombre = objeto.nombre.trim();
  }

  if (objeto.descripcion !== undefined) {
    if (typeof objeto.descripcion !== "string") {
      throw new AppError(422, "INVALID_DESCRIPTION", "La descripción debe ser texto");
    }
    parcial.descripcion = objeto.descripcion.trim();
  }

  return parcial;
}

/** Valida que un parámetro de ruta como `:id` sea un número entero positivo. */
export function validarIdProyecto(id: unknown): number {
  const numero = Number.isInteger(id) ? (id as number) : Number(id);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new AppError(400, "INVALID_ID", "El identificador no es válido");
  }

  return numero;
}

/**
 * Servicio de proyectos: aplica las reglas de negocio y coordina el repositorio.
 * No conoce HTTP ni Prisma. Sus métodos son asíncronos porque el repositorio
 * detrás de la interfaz puede ser la base de datos real (Prisma) o un mock.
 */
export class ProyectosService {
  private readonly repository: RepositorioProyectos;

  constructor(repository: RepositorioProyectos) {
    this.repository = repository;
  }

  async crear(dto: CrearProyectoDto): Promise<Proyecto> {
    const proyecto: Proyecto = {
      id: 0, // el repositorio asigna el id real
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? "",
      fechaCreacion: new Date().toISOString()
    };
    return this.repository.guardar(proyecto);
  }

  async obtenerTodas(): Promise<Proyecto[]> {
    return this.repository.obtenerTodas();
  }

  async buscarPorId(id: number): Promise<Proyecto> {
    const proyecto = await this.repository.buscarPorId(id);
    if (proyecto === undefined) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "El proyecto solicitado no existe");
    }
    return proyecto;
  }

  async reemplazar(id: number, dto: ActualizarProyectoDto): Promise<Proyecto> {
    const existente = await this.buscarPorId(id); // lanza 404 si no existe
    const actualizado: Proyecto = {
      ...existente,
      nombre: dto.nombre ?? existente.nombre,
      descripcion: dto.descripcion ?? existente.descripcion
    };
    // El update devuelve el registro; aquí ya conocemos los campos resultantes.
    // Si el registro desaparece entre la lectura y la escritura (TOCTOU), el
    // repositorio lanza 404 PROJECT_NOT_FOUND al detectar P2025.
    await this.repository.reemplazar(actualizado);
    return actualizado;
  }

  /** PATCH y PUT de proyecto comparten el mismo flujo en este dominio. */
  async modificarParcial(id: number, dto: ActualizarProyectoDto): Promise<Proyecto> {
    return this.reemplazar(id, dto);
  }

  async eliminar(id: number): Promise<void> {
    await this.buscarPorId(id); // lanza 404 si no existe
    await this.repository.eliminar(id); // las tareas se borran en cascada vía FK
  }
}