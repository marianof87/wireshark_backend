import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { crearAplicacion } from "../app.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// unidad-2/ (src/test → src → unidad-2)
const proyectoRoot = resolve(__dirname, "../..");
const prismaDir = join(proyectoRoot, "prisma");

export interface AppDePrueba {
  /** Aplicación Express lista para supertest. */
  app: ReturnType<typeof crearAplicacion>["app"];
  /** Cliente Prisma aislado de esta suite. */
  prisma: PrismaClient;
  /** Cierra Prisma y borra el archivo temporal de la suite. */
  cerrar: () => Promise<void>;
}

/**
 * Levanta la aplicación completa sobre una base SQLite aislada vía Prisma.
 *
 * - Crea un archivo `prisma/prueba-<uuid>.db` único por llamada.
 * - Ejecuta `prisma db push --skip-generate` para crear el esquema.
 * - Instancia `new PrismaClient({ datasourceUrl: url })`.
 * - Opcionalmente siembra datos con `sembrar(prisma)`.
 * - `cerrar()` hace `$disconnect()` y borra los archivos temporales.
 *
 * Cada llamada produce una base aislada y vacía, ideal para las pruebas de
 * integración del CRUD por HTTP.
 */
export async function levantarApp(opciones: {
  sembrar?: (prisma: PrismaClient) => Promise<void>;
} = {}): Promise<AppDePrueba> {
  mkdirSync(prismaDir, { recursive: true });

  const id = randomUUID();
  const filePath = join(prismaDir, `prueba-${id}.db`);
  // Prisma acepta "file:/ruta/absoluta.db" en datasourceUrl.
  const url = `file:${filePath}`;

  // Crea el esquema sin regenerar el cliente (ya generado en postinstall).
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    cwd: proyectoRoot,
    stdio: "pipe"
  });

  const prisma = new PrismaClient({ datasourceUrl: url });
  // Falla rápido si el esquema no se pudo crear.
  await prisma.$connect();

  if (opciones.sembrar) {
    await opciones.sembrar(prisma);
  }

  const { app } = crearAplicacion({ prisma });

  const cerrar = async (): Promise<void> => {
    try {
      await prisma.$disconnect();
    } finally {
      // Borra el archivo principal y los secundarios de SQLite (-wal/-shm/-journal).
      for (const sufijo of ["", "-wal", "-shm", "-journal"]) {
        const ruta = `${filePath}${sufijo}`;
        if (existsSync(ruta)) {
          try {
            unlinkSync(ruta);
          } catch {
            // En Windows puede estar mapeado por un instante: se ignora.
          }
        }
      }
    }
  };

  return { app, prisma, cerrar };
}