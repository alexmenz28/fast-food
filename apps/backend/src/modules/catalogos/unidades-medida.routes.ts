import type { FastifyPluginAsync } from "fastify";
import { mapPrismaError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";

export const unidadesMedidaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (_request, reply) => {
    try {
      const rows = await prisma.unidadMedida.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      });
      return {
        ok: true,
        data: rows.map((u) => ({ id: u.id, codigo: u.code, nombre: u.name })),
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });
};
