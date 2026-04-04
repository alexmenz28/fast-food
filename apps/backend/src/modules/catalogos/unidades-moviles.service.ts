import { MobileUnitStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export function estadoUnidadAEnum(estado: "ACTIVA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO"): MobileUnitStatus {
  if (estado === "ACTIVA") return "ACTIVE";
  if (estado === "MANTENIMIENTO") return "MAINTENANCE";
  return "OUT_OF_SERVICE";
}

export function enumAEstadoUnidad(status: MobileUnitStatus): "ACTIVA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO" {
  if (status === "ACTIVE") return "ACTIVA";
  if (status === "MAINTENANCE") return "MANTENIMIENTO";
  return "FUERA_DE_SERVICIO";
}

export function zonaDesdeDescripcion(description: string | null): string {
  if (!description) return "Sin zona";
  if (description.startsWith("Zona: ")) return description.slice(6);
  return description;
}

export async function generarCodigoUnidadMovil(): Promise<string> {
  const rows = await prisma.mobileUnit.findMany({ select: { code: true } });
  const ocupados = new Set(rows.map((r) => r.code.trim().toUpperCase()));
  let max = 0;
  for (const r of rows) {
    const m = /^UM-(\d+)$/i.exec(r.code.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  for (let n = max + 1; n < max + 10000; n++) {
    const code = `UM-${String(n).padStart(2, "0")}`;
    if (!ocupados.has(code.toUpperCase())) return code;
  }
  throw new Error("No se pudo generar codigo de unidad movil");
}

export async function actualizarAsignacionVigente(unitId: string, sellerId: string | null) {
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
