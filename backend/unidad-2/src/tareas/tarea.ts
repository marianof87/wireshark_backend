/**
 * Entidad `Tarea`: pertenece a un proyecto (`proyectoId`) y puede estar
 * completada o pendiente.
 *
 * `prioridad` está restringida a un conjunto cerrado de valores. El cliente
 * tampoco envía `id` ni `fechaCreacion`.
 */

export type Prioridad = "baja" | "media" | "alta";

export interface Tarea {
  id: number;
  proyectoId: number;
  titulo: string;
  prioridad: Prioridad;
  completada: boolean;
  fechaCreacion: string;
}

/** Datos mínimos para crear una tarea. */
export interface CrearTareaDto {
  proyectoId: number;
  titulo: string;
  prioridad: Prioridad;
}

/** Campos opcionales para modificar parcialmente una tarea (PATCH). */
export interface ActualizarTareaDto {
  titulo?: string;
  prioridad?: Prioridad;
  completada?: boolean;
}

export const PRIORIDADES: readonly Prioridad[] = ["baja", "media", "alta"];
