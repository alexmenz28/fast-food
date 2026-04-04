import type { FastifyPluginAsync } from "fastify";
import { effectiveCatalogoIsActive } from "../../lib/catalog-put.js";
import { badRequest, mapPrismaError, parseIdParams, parsearPaginacion } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { unidadMovilActualizarSchema, unidadMovilCrearSchema } from "./unidades-moviles.schemas.js";
import {
  actualizarAsignacionVigente,
  enumAEstadoUnidad,
  estadoUnidadAEnum,
  generarCodigoUnidadMovil,
  zonaDesdeDescripcion,
} from "./unidades-moviles.service.js";

export const unidadesMovilesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const paginacion = parsearPaginacion(request.query, reply);
    if (!("pagina" in paginacion)) return paginacion;
    const [total, rows] = await Promise.all([
      prisma.mobileUnit.count(),
      prisma.mobileUnit.findMany({
        skip: paginacion.skip,
        take: paginacion.take,
        orderBy: { createdAt: "desc" },
        include: {
          unitAssignments: {
            where: { isCurrent: true },
            include: { seller: true },
          },
        },
      }),
    ]);
    const totalPaginas = Math.max(1, Math.ceil(total / paginacion.limite));
    const data = rows.map((u) => ({
      id: u.id,
      codigo: u.code,
      zona: zonaDesdeDescripcion(u.description),
      estado: enumAEstadoUnidad(u.operationalStatus),
      idVendedor: u.unitAssignments[0]?.sellerId ?? null,
      activo: u.isActive,
      creadoEn: u.createdAt,
      actualizadoEn: u.updatedAt,
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
    const parsed = unidadMovilCrearSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const code = await generarCodigoUnidadMovil();
      const created = await prisma.mobileUnit.create({
        data: {
          code,
          description: `Zona: ${parsed.data.zona}`,
          operationalStatus: estadoUnidadAEnum(parsed.data.estado ?? "ACTIVA"),
          isActive: parsed.data.activo ?? true,
        },
      });
      await actualizarAsignacionVigente(created.id, parsed.data.idVendedor ?? null);
      const unit = await prisma.mobileUnit.findUniqueOrThrow({
        where: { id: created.id },
        include: { unitAssignments: { where: { isCurrent: true } } },
      });
      reply.code(201);
      return {
        ok: true,
        data: {
          id: unit.id,
          codigo: unit.code,
          zona: zonaDesdeDescripcion(unit.description),
          estado: enumAEstadoUnidad(unit.operationalStatus),
          idVendedor: unit.unitAssignments[0]?.sellerId ?? null,
          activo: unit.isActive,
          creadoEn: unit.createdAt,
          actualizadoEn: unit.updatedAt,
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
    const parsed = unidadMovilActualizarSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const existing = await prisma.mobileUnit.findUnique({ where: { id: params.id } });
      if (!existing) {
        reply.code(404);
        return { ok: false, error: "Registro no encontrado." };
      }
      const isActive = effectiveCatalogoIsActive(
        request.authUser?.role,
        parsed.data.activo,
        existing.isActive,
      );
      const updated = await prisma.mobileUnit.update({
        where: { id: params.id },
        data: {
          description: `Zona: ${parsed.data.zona}`,
          operationalStatus: estadoUnidadAEnum(parsed.data.estado ?? "ACTIVA"),
          isActive,
        },
      });
      if (!isActive) {
        await actualizarAsignacionVigente(updated.id, null);
      } else {
        await actualizarAsignacionVigente(updated.id, parsed.data.idVendedor ?? null);
      }
      const unit = await prisma.mobileUnit.findUniqueOrThrow({
        where: { id: updated.id },
        include: { unitAssignments: { where: { isCurrent: true } } },
      });
      return {
        ok: true,
        data: {
          id: unit.id,
          codigo: unit.code,
          zona: zonaDesdeDescripcion(unit.description),
          estado: enumAEstadoUnidad(unit.operationalStatus),
          idVendedor: unit.unitAssignments[0]?.sellerId ?? null,
          activo: unit.isActive,
          creadoEn: unit.createdAt,
          actualizadoEn: unit.updatedAt,
        },
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  /** Baja lógica: inactiva la unidad y cierra la asignación vigente de vendedor. */
  app.delete("/:id", async (request, reply) => {
    const params = parseIdParams(request.params, reply);
    if (!("id" in params)) {
      return params;
    }
    try {
      await prisma.unitSellerAssignment.updateMany({
        where: { unitId: params.id, isCurrent: true },
        data: { isCurrent: false, endDate: new Date() },
      });
      const updated = await prisma.mobileUnit.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      const unit = await prisma.mobileUnit.findUniqueOrThrow({
        where: { id: updated.id },
        include: { unitAssignments: { where: { isCurrent: true } } },
      });
      return {
        ok: true,
        data: {
          id: unit.id,
          codigo: unit.code,
          zona: zonaDesdeDescripcion(unit.description),
          estado: enumAEstadoUnidad(unit.operationalStatus),
          idVendedor: unit.unitAssignments[0]?.sellerId ?? null,
          activo: unit.isActive,
          creadoEn: unit.createdAt,
          actualizadoEn: unit.updatedAt,
        },
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });
};
