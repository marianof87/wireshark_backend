import { PrismaClient } from "@prisma/client";
import { AppError } from "../errors/app-error.ts";
import { esRegistroNoEncontrado, esViolacionDeClaveForanea } from "../db/prisma-errors.ts";
import type { Tarea } from "./tarea.ts";

/** Fila tal como la devuelve Prisma (fecha como `Date`). */
interface FilaTarea {
  id: number;
  proyectoId: number;
  titulo: string;
  prioridad: Tarea["prioridad"];
  completada: boolean;
  fechaCreacion: Date;
}

/** Traduce una fila de Prisma al dominio: la fecha se serializa en ISO 8601. */
function aTarea(fila: FilaTarea): Tarea {
  return {
    id: fila.id,
    proyectoId: fila.proyectoId,
    titulo: fila.titulo,
    prioridad: fila.prioridad,
    completada: fila.completada,
    fechaCreacion: fila.fechaCreacion.toISOString()
  };
}

/** Filtros opcionales que acepta el listado de tareas. */
export interface FiltroTareas {
  proyectoId?: number;
  completada?: boolean;
  q?: string;
  limite?: number;
}

export interface RepositorioTareas {
  guardar(tarea: Tarea): Promise<Tarea>;
  obtenerTodas(filtro?: FiltroTareas): Promise<Tarea[]>;
  buscarPorId(id: number): Promise<Tarea | undefined>;
  reemplazar(tarea: Tarea): Promise<void>;
  eliminar(id: number): Promise<void>;
}

export function crearRepositorioTareas(prisma: PrismaClient): RepositorioTareas {
  return {
    async guardar(tarea) {
      try {
        const creada = await prisma.tarea.create({
          data: {
            proyectoId: tarea.proyectoId,
            titulo: tarea.titulo,
            prioridad: tarea.prioridad,
            completada: tarea.completada,
            fechaCreacion: new Date(tarea.fechaCreacion)
          }
        });
        return aTarea(creada);
      } catch (error) {
        if (esViolacionDeClaveForanea(error)) {
          throw new AppError(404, "PROJECT_NOT_FOUND", "El proyecto de la tarea no existe");
        }
        throw error;
      }
    },

    async obtenerTodas(filtro: FiltroTareas = {}) {
      const where: {
        proyectoId?: number;
        completada?: boolean;
        titulo?: { contains: string };
      } = {};

      if (filtro.proyectoId !== undefined) {
        where.proyectoId = filtro.proyectoId;
      }
      if (filtro.completada !== undefined) {
        where.completada = filtro.completada;
      }
      if (filtro.q !== undefined && filtro.q.trim() !== "") {
        where.titulo = { contains: filtro.q.trim() };
      }

      const filas = await prisma.tarea.findMany({
        where,
        orderBy: { id: "asc" },
        take: filtro.limite
      });
      return filas.map(aTarea);
    },

    async buscarPorId(id) {
      const fila = await prisma.tarea.findUnique({ where: { id } });
      return fila === null ? undefined : aTarea(fila);
    },

    async reemplazar(tarea) {
      try {
        await prisma.tarea.update({
          where: { id: tarea.id },
          data: {
            titulo: tarea.titulo,
            prioridad: tarea.prioridad,
            completada: tarea.completada
          }
        });
      } catch (error) {
        if (esRegistroNoEncontrado(error)) {
          throw new AppError(404, "TASK_NOT_FOUND", "La tarea a reemplazar no existe");
        }
        throw error;
      }
    },

    async eliminar(id) {
      try {
        await prisma.tarea.delete({ where: { id } });
      } catch (error) {
        if (esRegistroNoEncontrado(error)) {
          throw new AppError(404, "TASK_NOT_FOUND", "La tarea a eliminar no existe");
        }
        throw error;
      }
    }
  };
}