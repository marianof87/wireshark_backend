-- CreateTable
CREATE TABLE "Proyecto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proyectoId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tarea_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
