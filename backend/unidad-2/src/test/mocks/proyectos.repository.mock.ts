import type { Proyecto } from "../../proyectos/proyecto.ts";
import type { RepositorioProyectos } from "../../proyectos/proyectos.repository.ts";

/**
 * Repositorio de proyectos SIMULADO (en memoria) para pruebas.
 *
 * Implementa la misma interfaz asíncrona que el repositorio Prisma real, de
 * modo que le sirve al `ProyectosService` en las pruebas unitarias sin tocar
 * una base de datos. Los datos de partida son MOCK, ajenos a cualquier estado
 * persistido.
 */
export function crearRepositorioProyectosMock(
  iniciales: Proyecto[] = [
    {
      id: 1,
      nombre: "Proyecto Alpha",
      descripcion: "Sitio web institucional",
      fechaCreacion: "2026-08-01T10:00:00.000Z"
    },
    {
      id: 2,
      nombre: "Proyecto Beta",
      descripcion: "API de pedidos",
      fechaCreacion: "2026-08-05T10:00:00.000Z"
    }
  ]
): RepositorioProyectos {
  const proyectos: Proyecto[] = [...iniciales];
  let secuencia = Math.max(0, ...proyectos.map((p) => p.id)) + 1;

  return {
    async guardar(proyecto): Promise<Proyecto> {
      const creado: Proyecto = { ...proyecto, id: secuencia++ };
      proyectos.push(creado);
      return creado;
    },

    async obtenerTodas(): Promise<Proyecto[]> {
      return [...proyectos];
    },

    async buscarPorId(id): Promise<Proyecto | undefined> {
      return proyectos.find((p) => p.id === id);
    },

    async reemplazar(proyecto): Promise<void> {
      const indice = proyectos.findIndex((p) => p.id === proyecto.id);
      if (indice >= 0) {
        proyectos[indice] = { ...proyecto };
      }
    },

    async eliminar(id): Promise<void> {
      const indice = proyectos.findIndex((p) => p.id === id);
      if (indice >= 0) {
        proyectos.splice(indice, 1);
      }
    }
  };
}