import type { Product } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export function categoriaATipoProducto(name: string): "ALIMENTO" | "BEBIDA" | "INSUMO" {
  if (name === "Alimentos") return "ALIMENTO";
  if (name === "Bebidas") return "BEBIDA";
  return "INSUMO";
}

function tipoProductoACategoria(tipo: "ALIMENTO" | "BEBIDA" | "INSUMO") {
  if (tipo === "ALIMENTO") return "Alimentos";
  if (tipo === "BEBIDA") return "Bebidas";
  return "Insumos";
}

export async function asegurarCategoria(tipo: "ALIMENTO" | "BEBIDA" | "INSUMO") {
  const name = tipoProductoACategoria(tipo);
  const existing = await prisma.productCategory.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.productCategory.create({ data: { name, isActive: true } });
  return created.id;
}

export async function generarCodigoProducto(): Promise<string> {
  const rows = await prisma.product.findMany({ select: { code: true } });
  const ocupados = new Set(rows.map((r) => r.code.trim().toUpperCase()));
  let max = 0;
  for (const r of rows) {
    const m = /^P(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  for (let n = max + 1; n < max + 10000; n++) {
    const code = `P${String(n).padStart(3, "0")}`;
    if (!ocupados.has(code.toUpperCase())) return code;
  }
  throw new Error("No se pudo generar codigo de producto");
}

export function mapProductoApi(p: Product & { category: { name: string }; measureUnit: { name: string } }) {
  return {
    id: p.id,
    codigo: p.code,
    nombre: p.name,
    tipo: categoriaATipoProducto(p.category.name),
    idUnidadMedida: p.measureUnitId,
    unidadMedida: p.measureUnit.name,
    activo: p.isActive,
    creadoEn: p.createdAt,
    actualizadoEn: p.updatedAt,
  };
}
