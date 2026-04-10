import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { badRequest, mapPrismaError } from "../../lib/http.js";
import {
  abastecimientoRegistrarSchema,
  abastecimientosQuerySchema,
  idParamSchema,
  jornadaCrearSchema,
  jornadasQuerySchema,
} from "./operaciones.schemas.js";
import {
  OperacionNegocioError,
  crearJornada,
  listarAbastecimientosPaginado,
  listarJornadasPaginado,
  listarZonasActivas,
  obtenerAbastecimientoPorId,
  obtenerJornadaPorId,
  registrarAbastecimiento,
} from "./operaciones.service.js";


/**
 * HU5 — Jornadas y abastecimiento diario desde almacén central (sin GPS / HU6).
 * Prefijos registrados en v1: `/zonas`, `/jornadas`, `/abastecimientos`.
 */
export const operacionesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/zonas", async (_request, reply) => {
    try {
      const data = await listarZonasActivas(prisma);
      return { ok: true, data };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.get("/jornadas", async (request, reply) => {
    const q = jornadasQuerySchema.safeParse(request.query);
    if (!q.success) {
      return badRequest(reply, q.error.issues[0]?.message ?? "Query inválida.");
    }
    const { pagina, limite, pendienteAbastecimiento } = q.data;
    const skip = (pagina - 1) * limite;
    try {
      const result = await listarJornadasPaginado(prisma, {
        skip,
        take: limite,
        pagina,
        limite,
        pendienteAbastecimiento,
      });
      return { ok: true, data: result.data, paginacion: result.paginacion };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.get("/jornadas/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return badRequest(reply, "ID inválido.");
    }
    try {
      const row = await obtenerJornadaPorId(prisma, params.data.id);
      if (!row) {
        reply.code(404);
        return { ok: false, error: "Jornada no encontrada." };
      }
      return { ok: true, data: row };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.post("/jornadas", async (request, reply) => {
    const parsed = jornadaCrearSchema.safeParse(request.body);
    if (!parsed.success) {
      const msgs = [...new Set(parsed.error.issues.map((i) => i.message))];
      return badRequest(reply, msgs[0] ?? "Datos inválidos.");
    }
    try {
      const data = await crearJornada(prisma, parsed.data);
      reply.code(201);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof OperacionNegocioError) {
        return badRequest(reply, err.message);
      }
      return mapPrismaError(err, reply);
    }
  });

  app.get("/abastecimientos", async (request, reply) => {
    const q = abastecimientosQuerySchema.safeParse(request.query);
    if (!q.success) {
      return badRequest(reply, q.error.issues[0]?.message ?? "Query inválida.");
    }
    const { pagina, limite } = q.data;
    const skip = (pagina - 1) * limite;
    try {
      const result = await listarAbastecimientosPaginado(prisma, {
        skip,
        take: limite,
        pagina,
        limite,
      });
      return { ok: true, data: result.data, paginacion: result.paginacion };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.get("/abastecimientos/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return badRequest(reply, "ID inválido.");
    }
    try {
      const row = await obtenerAbastecimientoPorId(prisma, params.data.id);
      if (!row) {
        reply.code(404);
        return { ok: false, error: "Abastecimiento no encontrado." };
      }
      return { ok: true, data: row };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.post("/abastecimientos", async (request, reply) => {
    const parsed = abastecimientoRegistrarSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const userId = request.authUser?.userId;
    if (!userId) {
      return badRequest(reply, "Usuario no identificado.");
    }
    try {
      const data = await registrarAbastecimiento(prisma, parsed.data, userId);
      reply.code(201);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof OperacionNegocioError) {
        return badRequest(reply, err.message);
      }
      return mapPrismaError(err, reply);
    }
  });
};
