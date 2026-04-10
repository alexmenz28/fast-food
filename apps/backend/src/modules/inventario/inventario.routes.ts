/**
 * HU4 — Inventario del almacén central: consulta de stock, ingresos, umbral mínimo.
 * Roles: ADMINISTRADOR y ALMACEN (escritura); SUPERVISOR solo lectura (GET).
 */
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest, mapPrismaError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import {
  inventarioIngresoSchema,
  inventarioMinimoSchema,
  inventarioStockQuerySchema,
} from "./inventario.schemas.js";
import {
  actualizarCantidadMinima,
  listarStockPaginado,
  obtenerAlmacenCentralId,
  registrarIngreso,
} from "./inventario.service.js";

function puedeEscribirInventario(rol: string | undefined): boolean {
  return rol === "ADMINISTRADOR" || rol === "ALMACEN";
}

const paramsProductoSchema = z.object({
  idProducto: z.string().uuid(),
});

export const inventarioRoutes: FastifyPluginAsync = async (app) => {
  app.get("/almacen", async (_request, reply) => {
    try {
      const id = await obtenerAlmacenCentralId(prisma);
      const wh = await prisma.almacen.findUnique({
        where: { id },
        select: { id: true, code: true, name: true, address: true },
      });
      return { ok: true, data: wh };
    } catch (err) {
      reply.code(500);
      return { ok: false, error: err instanceof Error ? err.message : "Error interno." };
    }
  });

  app.get("/stock", async (request, reply) => {
    const q = inventarioStockQuerySchema.safeParse(request.query);
    if (!q.success) {
      return badRequest(reply, q.error.issues[0]?.message ?? "Query inválida.");
    }
    const { pagina, limite, idCategoria } = q.data;
    const skip = (pagina - 1) * limite;

    try {
      const warehouseId = await obtenerAlmacenCentralId(prisma);
      const { total, filas } = await listarStockPaginado(prisma, {
        warehouseId,
        idCategoria,
        skip,
        take: limite,
      });
      const totalPaginas = Math.max(1, Math.ceil(total / limite));
      return {
        ok: true,
        data: filas,
        paginacion: {
          pagina,
          limite,
          total,
          totalPaginas,
        },
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.post("/ingresos", async (request, reply) => {
    if (!puedeEscribirInventario(request.authUser?.role)) {
      reply.code(403);
      return { ok: false, error: "Sin permisos para registrar ingresos de inventario." };
    }
    const parsed = inventarioIngresoSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    const userId = request.authUser?.userId;
    if (!userId) {
      return badRequest(reply, "Usuario no identificado.");
    }
    try {
      const warehouseId = await obtenerAlmacenCentralId(prisma);
      const rawFh = parsed.data.fechaHora?.trim() ?? "";
      const fechaHora = rawFh.length > 0 ? new Date(rawFh) : new Date();
      if (rawFh.length > 0 && Number.isNaN(fechaHora.getTime())) {
        return badRequest(reply, "fechaHora inválida.");
      }
      const data = await registrarIngreso(prisma, {
        warehouseId,
        userId,
        productId: parsed.data.idProducto,
        cantidad: parsed.data.cantidad,
        fechaHora,
        nota: parsed.data.nota,
      });
      reply.code(201);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof Error && err.message === "PRODUCTO_INACTIVO_O_INEXISTENTE") {
        return badRequest(reply, "Producto no encontrado o inactivo.");
      }
      return mapPrismaError(err, reply);
    }
  });

  app.patch("/stock/:idProducto/minimo", async (request, reply) => {
    if (!puedeEscribirInventario(request.authUser?.role)) {
      reply.code(403);
      return { ok: false, error: "Sin permisos para configurar stock mínimo." };
    }
    const params = paramsProductoSchema.safeParse(request.params);
    if (!params.success) {
      return badRequest(reply, "idProducto inválido.");
    }
    const parsed = inventarioMinimoSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const warehouseId = await obtenerAlmacenCentralId(prisma);
      const data = await actualizarCantidadMinima(prisma, {
        warehouseId,
        productId: params.data.idProducto,
        cantidadMinima: parsed.data.cantidadMinima,
      });
      return { ok: true, data };
    } catch (err) {
      if (err instanceof Error && err.message === "PRODUCTO_INACTIVO_O_INEXISTENTE") {
        return badRequest(reply, "Producto no encontrado o inactivo.");
      }
      return mapPrismaError(err, reply);
    }
  });
};
