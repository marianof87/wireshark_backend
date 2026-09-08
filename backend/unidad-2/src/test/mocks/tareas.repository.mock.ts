import type { Tarea } from "../../tareas/tarea.ts";
import type { FiltroTareas, RepositorioTareas } from "../../tareas/tareas.repository.ts";

/**
 * Repositorio de tareas SIMULADO (en memoria) para pruebas.
 *
 * Implementa la misma interfaz asíncrona que el repositorio Prisma real. Sólo
 * implementa el filtrado mínimo que ejercitan los tests del servicio, sin SQL.
 */
export function crearRepositorioTareasMock(
  iniciales: Tarea[] = [
    {
      id: 1,
      proyectoId: 1,
      titulo: "Diseñar el modelo de datos",
      prioridad: "alta",
      completada: false,
      fechaCreacion: "2026-08-02T09:00:00.000Z"
    },
    {
      id: 2,
      proyectoId: 1,
      titulo: "Maquetar pantalla de login",
      prioridad: "media",
      completada: true,
      fechaCreacion: "2026-08-03T09:00:00.000Z"
    }
  ]
): RepositorioTareas {
  const tareas: Tarea[] = [...iniciales];
  let secuencia = Math.max(0, ...tareas.map((t) => t.id)) + 1;

  const coincide = (tarea: Tarea, filtro: FiltroTareas = {}): boolean => {
    if (filtro.proyectoId !== undefined && tarea.proyectoId !== filtro.proyectoId) return false;
    if (filtro.completada !== undefined && tarea.completada !== filtro.completada) return false;
    if (
      filtro.q !== undefined &&
      filtro.q.trim() !== "" &&
      !tarea.titulo.toLowerCase().includes(filtro.q.toLowerCase())
    ) {
      return false;
    }
    return true;
  };

  return {
    async guardar(tarea): Promise<Tarea> {
      const creada: Tarea = { ...tarea, id: secuencia++ };
      tareas.push(creada);
      return creada;
    },

    async obtenerTodas(filtro): Promise<Tarea[]> {
      return tareas.filter((t) => coincide(t, filtro));
    },

    async buscarPorId(id): Promise<Tarea | undefined> {
      return tareas.find((t) => t.id === id);
    },

    async reemplazar(tarea): Promise<void> {
      const indice = tareas.findIndex((t) => t.id === tarea.id);
      if (indice >= 0) {
        tareas[indice] = { ...tarea };
      }
    },

    async eliminar(id): Promise<void> {
      const indice = tareas.findIndex((t) => t.id === id);
      if (indice >= 0) {
        tareas.splice(indice, 1);
      }
    }
  };
}