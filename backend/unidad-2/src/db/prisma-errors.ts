import { Prisma } from "@prisma/client";

/**
 * Detecta la violación de una restricción de base de datos lanzada por Prisma.
 *
 * El código P2003 corresponde a una violación de clave foránea: por ejemplo,
 * intentar crear una tarea cuyo `proyectoId` no existe. El servicio ya verifica
 * la existencia antes de escribir, pero esta defensa convierte la violación en
 * un 404 coherente con el contrato en lugar de un 500.
 */
export function esViolacionDeClaveForanea(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

/**
 * Detecta el error "registro a operar no existe" de Prisma (P2025).
 *
 * Aparece cuando un `update` o `delete` apunta a un id ya eliminado. Es la
 * defensa contra la ventana TOCTOU entre la comprobación previa del servicio
 * (`buscarPorId`) y la escritura: si el registro desaparece en ese instante,
 * esta detección lo traduce a un 404 coherente con el contrato.
 */
export function esRegistroNoEncontrado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}