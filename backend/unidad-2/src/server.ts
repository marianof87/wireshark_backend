import { crearAplicacion } from "./app.ts";
import { cerrarPrisma } from "./db/database.ts";

/**
 * Punto de entrada: sólo elige el puerto, arma la aplicación y escucha.
 *
 * Toda la conducta vive en `crearAplicacion`; este archivo no se importa desde
 * las pruebas, que levantan la aplicación con su propio cliente Prisma aislado.
 */
const puerto = Number(process.env.PORT ?? 3000);

const { app } = crearAplicacion();

const servidor = app.listen(puerto, () => {
  console.log(`Servidor disponible en http://localhost:${puerto}`);
  console.log(`Documentación interactiva (Swagger UI) en http://localhost:${puerto}/api/v1/docs`);
});

function apagar(): void {
  servidor.close(() => {
    cerrarPrisma().then(
      () => process.exit(0),
      (error) => {
        console.error("Error al cerrar Prisma:", error);
        process.exit(1);
      }
    );
  });
}

process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);