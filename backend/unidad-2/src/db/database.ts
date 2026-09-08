import { PrismaClient } from "@prisma/client";

/**
 * Conexión de base de datos gestionada por Prisma ORM.
 *
 * En producción se abre el archivo SQLite que defina `DATABASE_URL`
 * (por defecto `file:./dev.db`, que Prisma resuelve relativo a
 * `prisma/schema.prisma` → `prisma/dev.db`). Las pruebas inyectan su propio
 * cliente aislado a través de `crearAplicacion({ prisma })`, cada suite con su
 * archivo temporal, así que arrancan limpias y sin colisiones.
 */
export function crearClientePrisma(url?: string): PrismaClient {
  return new PrismaClient({
    datasourceUrl: url ?? process.env.DATABASE_URL ?? "file:./dev.db"
  });
}

/** Cliente singleton usado por la aplicación y por el servidor. */
let cliente: PrismaClient | undefined;

export const prisma: PrismaClient = (() => {
  cliente ??= crearClientePrisma();
  return cliente;
})();

/** Cierra la conexión global; útil para terminar procesos sin colgar el hilo. */
export async function cerrarPrisma(): Promise<void> {
  if (cliente !== undefined) {
    await cliente.$disconnect();
    cliente = undefined;
  }
}