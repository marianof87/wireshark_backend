import { PrismaClient } from "@prisma/client";
import { AppError } from "../errors/app-error.ts";
import { esRegistroNoEncontrado } from "../db/prisma-errors.ts";
import type { Proyecto } from "./proyecto.ts";

/** Fila tal como la devuelve Prisma (fecha como `Date`). */
interface FilaProyecto {
  id: number;
  nombre: string;
  descripcion: string;
  fechaCreacion: Date;
}

/** Traduce una fila de Prisma al dominio: la fecha se serializa en ISO 8601. */
function aProyecto(fila: FilaProyecto): Proyecto {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    fechaCreacion: fila.fechaCreacion.toISOString()
  };
}

/**
 * Repositorio de proyectos sobre Prisma ORM.
 *
 * Encapsula todo el acceso a la base: el resto de la aplicación sólo conoce
 * esta interfaz y no sabe que detrás hay un ORM. Así se sustituye por un
 * repositorio simulado en las pruebas sin tocar servicio ni controlador.
 */
export interface RepositorioProyectos {
  guardar(proyecto: Proyecto): Promise<Proyecto>;
  obtenerTodas(): Promise<Proyecto[]>;
  buscarPorId(id: number): Promise<Proyecto | undefined>;
  reemplazar(proyecto: Proyecto): Promise<void>;
  eliminar(id: number): Promise<void>;
}

export function crearRepositorioProyectos(prisma: PrismaClient): RepositorioProyectos {
  return {
    async guardar(proyecto) {
      const creado = await prisma.proyecto.create({
        data: {
          nombre: proyecto.nombre,
          descripcion: proyecto.descripcion,
          fechaCreacion: new Date(proyecto.fechaCreacion)
        }
      });
      return aProyecto(creado);
    },

    async obtenerTodas() {
      const filas = await prisma.proyecto.findMany({ orderBy: { id: "asc" } });
      return filas.map(aProyecto);
    },

    async buscarPorId(id) {
      const fila = await prisma.proyecto.findUnique({ where: { id } });
      return fila === null ? undefined : aProyecto(fila);
    },

    async reemplazar(proyecto) {
      try {
        await prisma.proyecto.update({
          where: { id: proyecto.id },
          data: { nombre: proyecto.nombre, descripcion: proyecto.descripcion }
        });
      } catch (error) {
        if (esRegistroNoEncontrado(error)) {
          throw new AppError(404, "PROJECT_NOT_FOUND", "El proyecto a reemplazar no existe");
        }
        throw error;
      }
    },

    async eliminar(id) {
      try {
        await prisma.proyecto.delete({ where: { id } });
      } catch (error) {
        if (esRegistroNoEncontrado(error)) {
          throw new AppError(404, "PROJECT_NOT_FOUND", "El proyecto a eliminar no existe");
        }
        throw error;
      }
    }
  };
}