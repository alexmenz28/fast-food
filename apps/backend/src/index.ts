import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const productBodySchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["FOOD", "DRINK", "SUPPLY"]),
  unitMeasure: z.string().trim().min(1).max(30),
  isActive: z.boolean().optional(),
});

const sellerBodySchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  documentId: z.string().trim().min(4).max(30),
  phone: z.string().trim().min(7).max(20),
  isActive: z.boolean().optional(),
});

const mobileUnitBodySchema = z.object({
  code: z.string().trim().min(1).max(30),
  zone: z.string().trim().min(2).max(120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "OUT_OF_SERVICE"]).optional(),
  sellerId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

const idParamsSchema = z.object({
  id: z.string().cuid(),
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
  console.error(err);
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

// Products CRUD
app.get("/products", async () => {
  const data = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return { ok: true, data };
});

app.post("/products", async (request, reply) => {
  const parsed = productBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const created = await prisma.product.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        unitMeasure: parsed.data.unitMeasure,
        isActive: parsed.data.isActive ?? true,
      },
    });
    reply.code(201);
    return { ok: true, data: created };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.put("/products/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  const parsed = productBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const updated = await prisma.product.update({
      where: { id: params.id },
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        unitMeasure: parsed.data.unitMeasure,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return { ok: true, data: updated };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.delete("/products/:id", async (request, reply) => {
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

// Sellers CRUD
app.get("/sellers", async () => {
  const data = await prisma.seller.findMany({
    orderBy: { createdAt: "desc" },
    include: { mobileUnit: true },
  });
  return { ok: true, data };
});

app.post("/sellers", async (request, reply) => {
  const parsed = sellerBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const created = await prisma.seller.create({
      data: {
        fullName: parsed.data.fullName,
        documentId: parsed.data.documentId,
        phone: parsed.data.phone,
        isActive: parsed.data.isActive ?? true,
      },
    });
    reply.code(201);
    return { ok: true, data: created };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.put("/sellers/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  const parsed = sellerBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const updated = await prisma.seller.update({
      where: { id: params.id },
      data: {
        fullName: parsed.data.fullName,
        documentId: parsed.data.documentId,
        phone: parsed.data.phone,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return { ok: true, data: updated };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.delete("/sellers/:id", async (request, reply) => {
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

// Mobile units CRUD
app.get("/mobile-units", async () => {
  const data = await prisma.mobileUnit.findMany({
    orderBy: { createdAt: "desc" },
    include: { seller: true },
  });
  return { ok: true, data };
});

app.post("/mobile-units", async (request, reply) => {
  const parsed = mobileUnitBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const created = await prisma.mobileUnit.create({
      data: {
        code: parsed.data.code,
        zone: parsed.data.zone,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        status: parsed.data.status ?? "ACTIVE",
        sellerId: parsed.data.sellerId ?? null,
        isActive: parsed.data.isActive ?? true,
      },
      include: { seller: true },
    });
    reply.code(201);
    return { ok: true, data: created };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.put("/mobile-units/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  const parsed = mobileUnitBodySchema.safeParse(request.body);
  if (!parsed.success) {
    return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  try {
    const updated = await prisma.mobileUnit.update({
      where: { id: params.id },
      data: {
        code: parsed.data.code,
        zone: parsed.data.zone,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        status: parsed.data.status ?? "ACTIVE",
        sellerId: parsed.data.sellerId ?? null,
        isActive: parsed.data.isActive ?? true,
      },
      include: { seller: true },
    });
    return { ok: true, data: updated };
  } catch (err) {
    return mapPrismaError(err, reply);
  }
});

app.delete("/mobile-units/:id", async (request, reply) => {
  const params = parseIdParams(request.params, reply);
  if (!("id" in params)) {
    return params;
  }
  try {
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
