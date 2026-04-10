import type { FastifyPluginAsync } from "fastify";
import { effectiveCatalogoIsActive } from "../../lib/catalog-put.js";
import { badRequest, mapPrismaError, parseIdParams, parsearPaginacion } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { vendedorBodySchema } from "./vendedores.schemas.js";

export const vendedoresRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const paginacion = parsearPaginacion(request.query, reply);
    if (!("pagina" in paginacion)) return paginacion;
    const [total, rows] = await Promise.all([
      prisma.vendedor.count(),
      prisma.vendedor.findMany({
        skip: paginacion.skip,
        take: paginacion.take,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const totalPaginas = Math.max(1, Math.ceil(total / paginacion.limite));
    const data = rows.map((s) => ({
      id: s.id,
      nombreCompleto: s.fullName,
      documento: s.identityDocument,
      telefono: s.phone ?? "",
      activo: s.isActive,
      creadoEn: s.createdAt,
      actualizadoEn: s.updatedAt,
    }));
    return {
      ok: true,
      data,
      paginacion: {
        pagina: paginacion.pagina,
        limite: paginacion.limite,
        total,
        totalPaginas,
      },
    };
  });

  app.post("/", async (request, reply) => {
    const parsed = vendedorBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const created = await prisma.vendedor.create({
        data: {
          fullName: parsed.data.nombreCompleto,
          identityDocument: parsed.data.documento,
          phone: parsed.data.telefono,
          isActive: parsed.data.activo ?? true,
        },
      });
      reply.code(201);
      return {
        ok: true,
        data: {
          id: created.id,
          nombreCompleto: created.fullName,
          documento: created.identityDocument,
          telefono: created.phone ?? "",
          activo: created.isActive,
          creadoEn: created.createdAt,
          actualizadoEn: created.updatedAt,
        },
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.put("/:id", async (request, reply) => {
    const params = parseIdParams(request.params, reply);
    if (!("id" in params)) {
      return params;
    }
    const parsed = vendedorBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const existing = await prisma.vendedor.findUnique({ where: { id: params.id } });
      if (!existing) {
        reply.code(404);
        return { ok: false, error: "Registro no encontrado." };
      }
      const isActive = effectiveCatalogoIsActive(
        request.authUser?.role,
        parsed.data.activo,
        existing.isActive,
      );
      const updated = await prisma.vendedor.update({
        where: { id: params.id },
        data: {
          fullName: parsed.data.nombreCompleto,
          identityDocument: parsed.data.documento,
          phone: parsed.data.telefono,
          isActive,
        },
      });
      return {
        ok: true,
        data: {
          id: updated.id,
          nombreCompleto: updated.fullName,
          documento: updated.identityDocument,
          telefono: updated.phone ?? "",
          activo: updated.isActive,
          creadoEn: updated.createdAt,
          actualizadoEn: updated.updatedAt,
        },
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  /** Baja lógica: marca inactivo. */
  app.delete("/:id", async (request, reply) => {
    const params = parseIdParams(request.params, reply);
    if (!("id" in params)) {
      return params;
    }
    try {
      const updated = await prisma.vendedor.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      return {
        ok: true,
        data: {
          id: updated.id,
          nombreCompleto: updated.fullName,
          documento: updated.identityDocument,
          telefono: updated.phone ?? "",
          activo: updated.isActive,
          creadoEn: updated.createdAt,
          actualizadoEn: updated.updatedAt,
        },
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });
};
