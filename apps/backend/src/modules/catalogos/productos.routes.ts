import type { FastifyPluginAsync } from "fastify";
import { effectiveCatalogoIsActive } from "../../lib/catalog-put.js";
import { badRequest, mapPrismaError, parseIdParams, parsearPaginacion } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { productoActualizarSchema, productoCrearSchema } from "./productos.schemas.js";
import {
  asegurarCategoria,
  generarCodigoProducto,
  mapProductoApi,
} from "./productos.service.js";

export const productosRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const paginacion = parsearPaginacion(request.query, reply);
    if (!("pagina" in paginacion)) return paginacion;
    const [total, rows] = await Promise.all([
      prisma.product.count(),
      prisma.product.findMany({
        skip: paginacion.skip,
        take: paginacion.take,
        orderBy: { createdAt: "desc" },
        include: { category: true, measureUnit: true },
      }),
    ]);
    const totalPaginas = Math.max(1, Math.ceil(total / paginacion.limite));
    const data = rows.map((p) => mapProductoApi(p));
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
    const parsed = productoCrearSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const unidad = await prisma.measureUnit.findFirst({
        where: { id: parsed.data.idUnidadMedida, isActive: true },
      });
      if (!unidad) {
        return badRequest(reply, "Unidad de medida no encontrada o inactiva.");
      }
      const categoryId = await asegurarCategoria(parsed.data.tipo);
      const code = await generarCodigoProducto();
      const created = await prisma.product.create({
        data: {
          code,
          name: parsed.data.nombre,
          categoryId,
          measureUnitId: parsed.data.idUnidadMedida,
          isActive: parsed.data.activo ?? true,
        },
        include: { category: true, measureUnit: true },
      });
      reply.code(201);
      return { ok: true, data: mapProductoApi(created) };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.put("/:id", async (request, reply) => {
    const params = parseIdParams(request.params, reply);
    if (!("id" in params)) {
      return params;
    }
    const parsed = productoActualizarSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const existing = await prisma.product.findUnique({ where: { id: params.id } });
      if (!existing) {
        reply.code(404);
        return { ok: false, error: "Registro no encontrado." };
      }
      const unidad = await prisma.measureUnit.findFirst({
        where: { id: parsed.data.idUnidadMedida, isActive: true },
      });
      if (!unidad) {
        return badRequest(reply, "Unidad de medida no encontrada o inactiva.");
      }
      const categoryId = await asegurarCategoria(parsed.data.tipo);
      const isActive = effectiveCatalogoIsActive(
        request.authUser?.role,
        parsed.data.activo,
        existing.isActive,
      );
      const updated = await prisma.product.update({
        where: { id: params.id },
        data: {
          name: parsed.data.nombre,
          categoryId,
          measureUnitId: parsed.data.idUnidadMedida,
          isActive,
        },
        include: { category: true, measureUnit: true },
      });
      return { ok: true, data: mapProductoApi(updated) };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  /** Baja lógica: marca inactivo (no borra fila; preserva historial e integridad referencial). */
  app.delete("/:id", async (request, reply) => {
    const params = parseIdParams(request.params, reply);
    if (!("id" in params)) {
      return params;
    }
    try {
      const updated = await prisma.product.update({
        where: { id: params.id },
        data: { isActive: false },
        include: { category: true, measureUnit: true },
      });
      return { ok: true, data: mapProductoApi(updated) };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });
};
