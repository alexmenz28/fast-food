import type { UnidadMovil } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

/** Estados operativos activos para formularios (orden configurado en BD). */
export async function listarEstadosUnidadMovilActivos() {
  return prisma.catalogoEstadoUnidadMovil.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true },
  });
}

export async function findEstadoUnidadMovilActivo(id: number) {
  return prisma.catalogoEstadoUnidadMovil.findFirst({
    where: { id, isActive: true },
  });
}

export async function generarCodigoUnidadMovil(): Promise<string> {
  const rows = await prisma.unidadMovil.findMany({ select: { code: true } });
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

/** Fecha calendario YYYY-MM-DD en UTC (compatible con columnas @db.Date). */
export function parseSoloFechaAsignacion(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function finDiaUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Asignación vigente si no hay fecha fin o la fecha fin es hoy o futura (solo componente fecha, UTC). */
export function asignacionEsVigente(endDate: Date | null): boolean {
  if (!endDate) return true;
  const hoy = finDiaUtc(new Date());
  return finDiaUtc(endDate) >= hoy;
}

export async function actualizarAsignacionVigente(
  unitId: string,
  sellerId: string | null,
  opts?: { startDate: Date; endDate: Date | null },
) {
  await prisma.asignacionUnidadVendedor.updateMany({
    where: { unitId, isCurrent: true },
    data: { isCurrent: false, endDate: new Date() },
  });
  if (!sellerId || !opts) return;
  const isCurrent = asignacionEsVigente(opts.endDate);
  await prisma.asignacionUnidadVendedor.create({
    data: {
      unitId,
      sellerId,
      startDate: opts.startDate,
      endDate: opts.endDate,
      isCurrent,
    },
  });
}

type UnidadConEstado = UnidadMovil & {
  estadoOperativo: { id: number; code: string; name: string };
};

type AsignacionVigente = { sellerId: string; startDate: Date; endDate: Date | null };

/** JSON de unidad móvil: sin zona de catálogo (esa dato va en cada jornada). */
export function mapUnidadMovilApi(u: UnidadConEstado, unitAssignments: AsignacionVigente[]) {
  const a = unitAssignments[0];
  return {
    id: u.id,
    codigo: u.code,
    placa: u.plate,
    descripcion: u.description ?? null,
    idEstadoOperativo: u.operationalStatusId,
    estadoCodigo: u.estadoOperativo.code,
    estadoNombre: u.estadoOperativo.name,
    idVendedor: a?.sellerId ?? null,
    asignacionFechaInicio: a ? a.startDate.toISOString().slice(0, 10) : null,
    asignacionFechaFin: a?.endDate ? a.endDate.toISOString().slice(0, 10) : null,
    activo: u.isActive,
    creadoEn: u.createdAt,
    actualizadoEn: u.updatedAt,
  };
}
