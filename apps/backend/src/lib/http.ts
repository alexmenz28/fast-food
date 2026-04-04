import { z } from "zod";

export function badRequest(reply: { code: (code: number) => void }, message: string) {
  reply.code(400);
  return { ok: false, error: message };
}

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

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export const paginacionQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(8),
});

export function parseIdParams(params: unknown, reply: { code: (code: number) => void }) {
  const parsed = idParamsSchema.safeParse(params);
  if (!parsed.success) {
    return badRequest(reply, "ID inválido");
  }
  return parsed.data;
}

export function parsearPaginacion(query: unknown, reply: { code: (code: number) => void }) {
  const parsed = paginacionQuerySchema.safeParse(query);
  if (!parsed.success) return badRequest(reply, "Parámetros de paginación inválidos.");
  const { pagina, limite } = parsed.data;
  return { pagina, limite, skip: (pagina - 1) * limite, take: limite };
}
