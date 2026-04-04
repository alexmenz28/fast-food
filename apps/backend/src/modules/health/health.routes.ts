import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({ ok: true, service: "fast-food-abastecimiento-api" }));

  app.get("/health/db", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: "connected" };
    } catch {
      reply.code(503);
      return { ok: false, database: "disconnected" };
    }
  });
};
