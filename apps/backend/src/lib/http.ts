/**
 * Utilidades HTTP compartidas por varios módulos (productos, vendedores, auth, …).
 *
 * - Respuestas JSON homogéneas `{ ok, error }` en errores de validación.
 * - Parsing reutilizable de `params.id` (UUID) y query de paginación.
 * - Traducción de códigos Prisma conocidos a status HTTP legibles.
 */
import { z } from "zod";

/** 400 + cuerpo JSON de error; usado tras fallos de Zod o reglas de negocio en routes. */
export function badRequest(reply: { code: (code: number) => void }, message: string) {
  reply.code(400);
  return { ok: false, error: message };
}

/** Mapea errores Prisma frecuentes (unicidad, FK, no encontrado) a 409/400/404/500. */
export function mapPrismaError(err: unknown, reply: { code: (code: number) => void }) {
  const maybe = err as { code?: string } | undefined;
  if (maybe?.code === "P2002") {
    reply.code(409);
    return { ok: false, error: "Registro duplicado (campo único)." };
  }
  if (maybe?.code === "P2003") {
    reply.code(400);
    return {
      ok: false,
      error:
        "No se puede eliminar: hay registros relacionados (inventario, movimientos, abastecimientos, etc.).",
    };
  }
  if (maybe?.code === "P2025") {
    reply.code(404);
    return { ok: false, error: "Registro no encontrado." };
  }
  reply.code(500);
  return { ok: false, error: "Error interno del servidor." };
}

/** Valida `request.params` en rutas con `:id` UUID (p. ej. PUT/DELETE productos). */
export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Query estándar `?pagina=&limite=` para listados; usado en GET de catálogos. */
export const paginacionQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(8),
});

/** Si falla validación, devuelve el objeto de error (el route debe hacer `return`). */
export function parseIdParams(params: unknown, reply: { code: (code: number) => void }) {
  const parsed = idParamsSchema.safeParse(params);
  if (!parsed.success) {
    return badRequest(reply, "ID inválido");
  }
  return parsed.data;
}

/** Devuelve `{ pagina, limite, skip, take }` para Prisma o el resultado de `badRequest`. */
export function parsearPaginacion(query: unknown, reply: { code: (code: number) => void }) {
  const parsed = paginacionQuerySchema.safeParse(query);
  if (!parsed.success) return badRequest(reply, "Parámetros de paginación inválidos.");
  const { pagina, limite } = parsed.data;
  return { pagina, limite, skip: (pagina - 1) * limite, take: limite };
}
