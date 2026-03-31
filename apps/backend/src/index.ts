import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MobileUnitStatus, PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const productoBodySchema = z.object({
  codigo: z.string().trim().min(1).max(30),
  nombre: z.string().trim().min(2).max(120),
  tipo: z.enum(["ALIMENTO", "BEBIDA", "INSUMO"]),
  unidadMedida: z.string().trim().min(1).max(30),
  activo: z.boolean().optional(),
});

const vendedorBodySchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(120),
  documento: z.string().trim().min(4).max(30),
  telefono: z.string().trim().min(7).max(20),
  activo: z.boolean().optional(),
});

const unidadMovilBodySchema = z.object({
  codigo: z.string().trim().min(1).max(30),
  zona: z.string().trim().min(2).max(120),
  estado: z.enum(["ACTIVA", "MANTENIMIENTO", "FUERA_DE_SERVICIO"]).optional(),
  idVendedor: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const paginacionQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(8),
});

function badRequest(reply: { code: (code: number) => void }, message: string) {
  reply.code(400);
  return { ok: false, error: message };
}

function parseIdParams(params: unknown, reply: { code: (code: number) => void }) {
  const parsed = idParamsSchema.safeParse(params);
  if (!parsed.success) {
    return badRequest(reply, "ID inválido");
  }
  return parsed.data;
}

function mapPrismaError(err: unknown, reply: { code: (code: number) => void }) {
  const maybe = err as { code?: string } | undefined;
  if (maybe?.code === "P2002") {
    reply.code(409);
    return { ok: false, error: "Registro duplicado (campo único)." };
  }
  if (maybe?.code === "P2003") {
    reply.code(400);
    return { ok: false, error: "Relación inválida (referencia no encontrada)." };
  }
  if (maybe?.code === "P2025") {
    reply.code(404);
    return { ok: false, error: "Registro no encontrado." };
  }
  reply.code(500);
  return { ok: false, error: "Error interno del servidor." };
}

app.get("/health", async () => ({ ok: true }));

app.get("/health/db", async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, database: "connected" };
  } catch {
    reply.code(503);
    return { ok: false, database: "disconnected" };
  }
});

function tipoProductoACategoria(tipo: "ALIMENTO" | "BEBIDA" | "INSUMO") {
  if (tipo === "ALIMENTO") return "Alimentos";
  if (tipo === "BEBIDA") return "Bebidas";
  return "Insumos";
}

function categoriaATipoProducto(name: string): "ALIMENTO" | "BEBIDA" | "INSUMO" {
  if (name === "Alimentos") return "ALIMENTO";
  if (name === "Bebidas") return "BEBIDA";
  return "INSUMO";
}

function estadoUnidadAEnum(estado: "ACTIVA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO"): MobileUnitStatus {
  if (estado === "ACTIVA") return "ACTIVE";
  if (estado === "MANTENIMIENTO") return "MAINTENANCE";
  return "OUT_OF_SERVICE";
}

function enumAEstadoUnidad(status: MobileUnitStatus): "ACTIVA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO" {
  if (status === "ACTIVE") return "ACTIVA";
  if (status === "MAINTENANCE") return "MANTENIMIENTO";
  return "FUERA_DE_SERVICIO";
}

function zonaDesdeDescripcion(description: string | null): string {
  if (!description) return "Sin zona";
  if (description.startsWith("Zona: ")) return description.slice(6);
  return description;
}

async function asegurarCategoria(tipo: "ALIMENTO" | "BEBIDA" | "INSUMO") {
  const name = tipoProductoACategoria(tipo);
  const existing = await prisma.productCategory.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.productCategory.create({ data: { name, isActive: true } });
  return created.id;
}

async function asegurarUnidadMedida(rawUnidadMedida: string) {
  const normalizedName = rawUnidadMedida.trim();
  const code = normalizedName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "UND";
  const existing = await prisma.measureUnit.findFirst({
    where: { OR: [{ code }, { name: normalizedName }] },
  });
  if (existing) return existing.id;
  const created = await prisma.measureUnit.create({
    data: { code, name: normalizedName, isActive: true },
  });
  return created.id;
}

async function actualizarAsignacionVigente(unitId: string, sellerId: string | null) {
  await prisma.unitSellerAssignment.updateMany({
    where: { unitId, isCurrent: true },
    data: { isCurrent: false, endDate: new Date() },
  });
  if (!sellerId) return;
  await prisma.unitSellerAssignment.create({
    data: {
      unitId,
      sellerId,
      startDate: new Date(),
      isCurrent: true,
    },
  });
}

function parsearPaginacion(query: unknown, reply: { code: (code: number) => void }) {
  const parsed = paginacionQuerySchema.safeParse(query);
  if (!parsed.success) return badRequest(reply, "Parámetros de paginación inválidos.");
  const { pagina, limite } = parsed.data;
  return { pagina, limite, skip: (pagina - 1) * limite, take: limite };
}

// Productos CRUD
app.get("/productos", async (request, reply) => {
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
  const data = rows.map((p) => ({
    id: p.id,
    codigo: p.code,
    nombre: p.name,
    tipo: categoriaATipoProducto(p.category.name),
    unidadMedida: p.measureUnit.name,
    activo: p.isActive,
    creadoEn: p.createdAt,
    actualizadoEn: p.updatedAt,
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

app.post("/productos", async (request, reply) => {
  const parsed = productoBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const categoryId = await asegurarCategoria(parsed.data.tipo);
    const measureUnitId = await asegurarUnidadMedida(parsed.data.unidadMedida);
    const created = await prisma.product.create({
      data: {
        code: parsed.data.codigo,
        name: parsed.data.nombre,
        categoryId,
        measureUnitId,
        isActive: parsed.data.activo ?? true,
      },
      include: { category: true, measureUnit: true },
    });
    reply.code(201);
    return {
      ok: true,
      data: {
        id: created.id,
        codigo: created.code,
        nombre: created.name,
        tipo: categoriaATipoProducto(created.category.name),
        unidadMedida: created.measureUnit.name,
        activo: created.isActive,
        creadoEn: created.createdAt,
        actualizadoEn: created.updatedAt,
      },
    };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.put("/productos/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  const parsed = productoBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const categoryId = await asegurarCategoria(parsed.data.tipo);
    const measureUnitId = await asegurarUnidadMedida(parsed.data.unidadMedida);
    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        code: parsed.data.codigo,
        name: parsed.data.nombre,
        categoryId,
        measureUnitId,
        isActive: parsed.data.activo ?? true,
      },
      include: { category: true, measureUnit: true },
    });
    return {
      ok: true,
      data: {
        id: updated.id,
        codigo: updated.code,
        nombre: updated.name,
        tipo: categoriaATipoProducto(updated.category.name),
        unidadMedida: updated.measureUnit.name,
        activo: updated.isActive,
        creadoEn: updated.createdAt,
        actualizadoEn: updated.updatedAt,
      },
    };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.delete("/productos/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  try {
    await prisma.product.delete({ where: { id: params.id } });
    return { ok: true };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

// Vendedores CRUD
app.get("/vendedores", async (request, reply) => {
  const paginacion = parsearPaginacion(request.query, reply);
  if (!("pagina" in paginacion)) return paginacion;
  const [total, rows] = await Promise.all([
    prisma.seller.count(),
    prisma.seller.findMany({
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

app.post("/vendedores", async (request, reply) => {
  const parsed = vendedorBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const created = await prisma.seller.create({
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

app.put("/vendedores/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  const parsed = vendedorBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const updated = await prisma.seller.update({
      where: { id: params.id },
      data: {
        fullName: parsed.data.nombreCompleto,
        identityDocument: parsed.data.documento,
        phone: parsed.data.telefono,
        isActive: parsed.data.activo ?? true,
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

app.delete("/vendedores/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  try {
    await prisma.seller.delete({ where: { id: params.id } });
    return { ok: true };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

// Unidades móviles CRUD
app.get("/unidades-moviles", async (request, reply) => {
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

app.post("/unidades-moviles", async (request, reply) => {
  const parsed = unidadMovilBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const created = await prisma.mobileUnit.create({
      data: {
        code: parsed.data.codigo,
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

app.put("/unidades-moviles/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  const parsed = unidadMovilBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const updated = await prisma.mobileUnit.update({
      where: { id: params.id },
      data: {
        code: parsed.data.codigo,
        description: `Zona: ${parsed.data.zona}`,
        operationalStatus: estadoUnidadAEnum(parsed.data.estado ?? "ACTIVA"),
        isActive: parsed.data.activo ?? true,
      },
    });
    await actualizarAsignacionVigente(updated.id, parsed.data.idVendedor ?? null);
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

app.delete("/unidades-moviles/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  try {
    await prisma.unitSellerAssignment.deleteMany({ where: { unitId: params.id } });
    await prisma.mobileUnit.delete({ where: { id: params.id } });
    return { ok: true };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
