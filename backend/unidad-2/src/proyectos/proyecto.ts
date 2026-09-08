/**
 * Entidad `Proyecto`: un agrupador de tareas (relación 1 → N).
 *
 * El cliente nunca envía `id` ni `fechaCreacion`: ambos los genera el servidor.
 * Por eso existen DTO distintos para entrada y salida.
 */

export interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string;
  fechaCreacion: string;
}

/** Datos mínimos para crear un proyecto. */
export interface CrearProyectoDto {
  nombre: string;
  descripcion?: string;
}

/** Campos opcionales para modificar parcialmente un proyecto (PATCH). */
export interface ActualizarProyectoDto {
  nombre?: string;
  descripcion?: string;
}
