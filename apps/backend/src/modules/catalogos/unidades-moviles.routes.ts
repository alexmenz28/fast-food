import type { FastifyPluginAsync } from "fastify";
import { effectiveCatalogoIsActive } from "../../lib/catalog-put.js";
import { badRequest, mapPrismaError, parseIdParams, parsearPaginacion } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { unidadMovilActualizarSchema, unidadMovilCrearSchema } from "./unidades-moviles.schemas.js";
import {
  actualizarAsignacionVigente,
  findEstadoUnidadMovilActivo,
  generarCodigoUnidadMovil,
  listarEstadosUnidadMovilActivos,
  mapUnidadMovilApi,
  parseSoloFechaAsignacion,
} from "./unidades-moviles.service.js";

function opcionesAsignacionDesdeBody(data: {
  idVendedor?: string | null;
  fechaInicioAsignacion?: string;
  fechaFinAsignacion?: string;
}) {
  if (!data.idVendedor || !data.fechaInicioAsignacion) return undefined;
  return {
    startDate: parseSoloFechaAsignacion(data.fechaInicioAsignacion),
    endDate: data.fechaFinAsignacion ? parseSoloFechaAsignacion(data.fechaFinAsignacion) : null,
  };
}

const includeUnidad = {
  estadoOperativo: true,
  asignacionesVendedor: {
    where: { isCurrent: true },
    orderBy: { startDate: "desc" as const },
  },
} as const;

export const unidadesMovilesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/estados", async (_request, reply) => {
    try {
      const rows = await listarEstadosUnidadMovilActivos();
      return {
        ok: true,
        data: rows.map((r) => ({ id: r.id, codigo: r.code, nombre: r.name })),
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.get("/", async (request, reply) => {
    const paginacion = parsearPaginacion(request.query, reply);
    if (!("pagina" in paginacion)) return paginacion;
    const [total, rows] = await Promise.all([
      prisma.unidadMovil.count(),
      prisma.unidadMovil.findMany({
        skip: paginacion.skip,
        take: paginacion.take,
        orderBy: { createdAt: "desc" },
        include: includeUnidad,
      }),
    ]);
    const totalPaginas = Math.max(1, Math.ceil(total / paginacion.limite));
    const data = rows.map((u) =>
      mapUnidadMovilApi(
        u,
        u.asignacionesVendedor.map((a) => ({
          sellerId: a.sellerId,
          startDate: a.startDate,
          endDate: a.endDate,
        })),
      ),
    );
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
      const estado = await findEstadoUnidadMovilActivo(parsed.data.idEstadoOperativo);
      if (!estado) {
        return badRequest(reply, "Estado operativo no encontrado o inactivo.");
      }
      const code = await generarCodigoUnidadMovil();
      const created = await prisma.unidadMovil.create({
        data: {
          code,
          plate: parsed.data.placa,
          description: parsed.data.descripcion,
          operationalStatusId: estado.id,
          isActive: parsed.data.activo ?? true,
        },
      });
      await actualizarAsignacionVigente(
        created.id,
        parsed.data.idVendedor ?? null,
        opcionesAsignacionDesdeBody(parsed.data),
      );
      const unit = await prisma.unidadMovil.findUniqueOrThrow({
        where: { id: created.id },
        include: includeUnidad,
      });
      reply.code(201);
      return {
        ok: true,
        data: mapUnidadMovilApi(
          unit,
          unit.asignacionesVendedor.map((a) => ({
            sellerId: a.sellerId,
            startDate: a.startDate,
            endDate: a.endDate,
          })),
        ),
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
      const existing = await prisma.unidadMovil.findUnique({ where: { id: params.id } });
      if (!existing) {
        reply.code(404);
        return { ok: false, error: "Registro no encontrado." };
      }
      const estado = await findEstadoUnidadMovilActivo(parsed.data.idEstadoOperativo);
      if (!estado) {
        return badRequest(reply, "Estado operativo no encontrado o inactivo.");
      }
      const isActive = effectiveCatalogoIsActive(
        request.authUser?.role,
        parsed.data.activo,
        existing.isActive,
      );
      const updated = await prisma.unidadMovil.update({
        where: { id: params.id },
        data: {
          plate: parsed.data.placa,
          description: parsed.data.descripcion,
          operationalStatusId: estado.id,
          isActive,
        },
      });
      if (!isActive) {
        await actualizarAsignacionVigente(updated.id, null);
      } else {
        await actualizarAsignacionVigente(
          updated.id,
          parsed.data.idVendedor ?? null,
          opcionesAsignacionDesdeBody(parsed.data),
        );
      }
      const unit = await prisma.unidadMovil.findUniqueOrThrow({
        where: { id: updated.id },
        include: includeUnidad,
      });
      return {
        ok: true,
        data: mapUnidadMovilApi(
          unit,
          unit.asignacionesVendedor.map((a) => ({
            sellerId: a.sellerId,
            startDate: a.startDate,
            endDate: a.endDate,
          })),
        ),
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
      await prisma.asignacionUnidadVendedor.updateMany({
        where: { unitId: params.id, isCurrent: true },
        data: { isCurrent: false, endDate: new Date() },
      });
      const updated = await prisma.unidadMovil.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      const unit = await prisma.unidadMovil.findUniqueOrThrow({
        where: { id: updated.id },
        include: includeUnidad,
      });
      return {
        ok: true,
        data: mapUnidadMovilApi(
          unit,
          unit.asignacionesVendedor.map((a) => ({
            sellerId: a.sellerId,
            startDate: a.startDate,
            endDate: a.endDate,
          })),
        ),
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });
};
