/**
 * Rutas REST del catálogo de productos (adaptador HTTP). La lógica vive en
 * `@fastfood/catalogos-core` (aplicación + puertos); Prisma se implementa en
 * `adapters/catalogos/prisma-productos.persistence.ts`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ auth-gate: JWT + rol                                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *        │
 *        ▼
 * ┌──────────────────┐   ┌─────────────────────┐   ┌────────────────────────┐
 * │ productos.schemas│   │ lib/http.ts         │   │ lib/catalog-put.ts     │
 * │ (Zod)            │   │ badRequest, parse*  │   │ effectiveCatalogoIsAct…│
 * └────────┬─────────┘   └─────────────────────┘   └────────────────────────┘
 *          │
 *          ▼
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ ProductosApplication (@fastfood/catalogos-core)                         │
 * └────────────────────────────────────────────────────────────────────────┘
 */
import {
  CatalogosValidationError,
  ProductoNotFoundError,
} from "@fastfood/catalogos-core";
import type { FastifyPluginAsync } from "fastify";
import { createProductosApplication } from "../../composition/catalogos-wiring.js";
import { asegurarFilaStockProducto } from "../inventario/inventario.service.js";
import { effectiveCatalogoIsActive } from "../../lib/catalog-put.js";
import { badRequest, mapPrismaError, parseIdParams, parsearPaginacion } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { productoActualizarSchema, productoCrearSchema } from "./productos.schemas.js";

const productosApp = createProductosApplication(prisma);

function mapCoreError(
  err: unknown,
  reply: Parameters<typeof badRequest>[0],
): ReturnType<typeof badRequest> | { ok: false; error: string } | null {
  if (err instanceof CatalogosValidationError) {
    return badRequest(reply, err.message);
  }
  if (err instanceof ProductoNotFoundError) {
    reply.code(404);
    return { ok: false, error: err.message };
  }
  return null;
}

export const productosRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categorias", async (_request, reply) => {
    try {
      const rows = await productosApp.listCategoriasActivas();
      return {
        ok: true,
        data: rows.map((c) => ({ id: c.id, nombre: c.name })),
      };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.get("/", async (request, reply) => {
    const paginacion = parsearPaginacion(request.query, reply);
    if (!("pagina" in paginacion)) return paginacion;
    try {
      const result = await productosApp.listProductos({
        skip: paginacion.skip,
        take: paginacion.take,
        pagina: paginacion.pagina,
        limite: paginacion.limite,
      });
      return { ok: true, data: result.data, paginacion: result.paginacion };
    } catch (err) {
      return mapPrismaError(err, reply);
    }
  });

  app.post("/", async (request, reply) => {
    const parsed = productoCrearSchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }
    try {
      const data = await productosApp.crear({
        nombre: parsed.data.nombre,
        idCategoria: parsed.data.idCategoria,
        idUnidadMedida: parsed.data.idUnidadMedida,
        activo: parsed.data.activo,
      });
      await asegurarFilaStockProducto(prisma, data.id);
      reply.code(201);
      return { ok: true, data };
    } catch (err) {
      const mapped = mapCoreError(err, reply);
      if (mapped) return mapped;
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
      const existing = await prisma.producto.findUnique({
        where: { id: params.id },
        select: { isActive: true },
      });
      if (!existing) {
        reply.code(404);
        return { ok: false, error: "Registro no encontrado." };
      }
      const isActive = effectiveCatalogoIsActive(
        request.authUser?.role,
        parsed.data.activo,
        existing.isActive,
      );
      const data = await productosApp.actualizar(params.id, {
        nombre: parsed.data.nombre,
        idCategoria: parsed.data.idCategoria,
        idUnidadMedida: parsed.data.idUnidadMedida,
        isActive,
      });
      return { ok: true, data };
    } catch (err) {
      const mapped = mapCoreError(err, reply);
      if (mapped) return mapped;
      return mapPrismaError(err, reply);
    }
  });

  app.delete("/:id", async (request, reply) => {
    const params = parseIdParams(request.params, reply);
    if (!("id" in params)) {
      return params;
    }
    try {
      const data = await productosApp.bajaLogica(params.id);
      return { ok: true, data };
    } catch (err) {
      const mapped = mapCoreError(err, reply);
      if (mapped) return mapped;
      return mapPrismaError(err, reply);
    }
  });
};
