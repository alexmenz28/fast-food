import {
  JourneyStatus,
  MovementType,
  Prisma,
  ReferenceType,
  SupplyStatus,
  type PrismaClient,
} from "@prisma/client";
import { obtenerAlmacenCentralId } from "../inventario/inventario.service.js";
import { mensajeErrorHorarioJornada } from "./jornada-horario.js";

export class OperacionNegocioError extends Error {
  constructor(
    readonly codigo: string,
    message: string,
  ) {
    super(message);
    this.name = "OperacionNegocioError";
  }
}

function parseFechaOperacion(yyyyMmDd: string): Date {
  const d = new Date(`${yyyyMmDd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new OperacionNegocioError("FECHA_INVALIDA", "La fecha de operación no es válida.");
  }
  return d;
}

/** Hora almacenada como @db.Time (solo componente horario). */
function parseHora(hhMm: string): Date {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(hhMm.trim());
  if (!m) {
    throw new OperacionNegocioError("HORA_INVALIDA", "Formato de hora inválido.");
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  return new Date(Date.UTC(1970, 0, 1, h, min, 0, 0));
}

export type ZonaApi = { id: string; nombre: string };

export async function listarZonasActivas(prisma: PrismaClient): Promise<ZonaApi[]> {
  const rows = await prisma.zona.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((z) => ({ id: z.id, nombre: z.name }));
}

export type JornadaListaApi = {
  id: string;
  idUnidad: string;
  codigoUnidad: string;
  idVendedor: string;
  nombreVendedor: string;
  idZona: string;
  nombreZona: string;
  fechaOperacion: string;
  horaInicio: string;
  horaFin: string | null;
  estado: JourneyStatus;
  tieneAbastecimiento: boolean;
  idAbastecimiento: string | null;
};

function formatHora(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function listarJornadasPaginado(
  prisma: PrismaClient,
  opts: {
    skip: number;
    take: number;
    pagina: number;
    limite: number;
    pendienteAbastecimiento?: boolean;
  },
): Promise<{ total: number; data: JornadaListaApi[]; paginacion: object }> {
  const where: Prisma.JornadaWhereInput = {};
  if (opts.pendienteAbastecimiento === true) {
    where.status = JourneyStatus.PLANNED;
  }

  const [total, rows] = await Promise.all([
    prisma.jornada.count({ where }),
    prisma.jornada.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: [{ operationDate: "desc" }, { createdAt: "desc" }],
      include: {
        unidad: { select: { id: true, code: true } },
        vendedor: { select: { id: true, fullName: true } },
        zona: { select: { id: true, name: true } },
        abastecimientos: {
          where: { status: { not: SupplyStatus.CANCELLED } },
          take: 1,
          orderBy: { deliveredAt: "desc" },
          select: { id: true },
        },
      },
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / opts.limite));
  const data: JornadaListaApi[] = rows.map((r) => {
    const sup = r.abastecimientos[0];
    return {
      id: r.id,
      idUnidad: r.unitId,
      codigoUnidad: r.unidad.code,
      idVendedor: r.sellerId,
      nombreVendedor: r.vendedor.fullName,
      idZona: r.zoneId,
      nombreZona: r.zona.name,
      fechaOperacion: r.operationDate.toISOString().slice(0, 10),
      horaInicio: formatHora(r.startTime),
      horaFin: r.endTime ? formatHora(r.endTime) : null,
      estado: r.status,
      tieneAbastecimiento: Boolean(sup),
      idAbastecimiento: sup?.id ?? null,
    };
  });

  return {
    total,
    data,
    paginacion: {
      pagina: opts.pagina,
      limite: opts.limite,
      total,
      totalPaginas,
    },
  };
}

export type JornadaDetalleApi = JornadaListaApi;

export async function obtenerJornadaPorId(
  prisma: PrismaClient,
  id: string,
): Promise<JornadaDetalleApi | null> {
  const r = await prisma.jornada.findUnique({
    where: { id },
    include: {
      unidad: { select: { id: true, code: true } },
      vendedor: { select: { id: true, fullName: true } },
      zona: { select: { id: true, name: true } },
      abastecimientos: {
        where: { status: { not: SupplyStatus.CANCELLED } },
        take: 1,
        orderBy: { deliveredAt: "desc" },
        select: { id: true },
      },
    },
  });
  if (!r) return null;
  const sup = r.abastecimientos[0];
  return {
    id: r.id,
    idUnidad: r.unitId,
    codigoUnidad: r.unidad.code,
    idVendedor: r.sellerId,
    nombreVendedor: r.vendedor.fullName,
    idZona: r.zoneId,
    nombreZona: r.zona.name,
    fechaOperacion: r.operationDate.toISOString().slice(0, 10),
    horaInicio: formatHora(r.startTime),
    horaFin: r.endTime ? formatHora(r.endTime) : null,
    estado: r.status,
    tieneAbastecimiento: Boolean(sup),
    idAbastecimiento: sup?.id ?? null,
  };
}

export async function crearJornada(
  prisma: PrismaClient,
  input: {
    idUnidad: string;
    idVendedor: string;
    idZona: string;
    fechaOperacion: string;
    horaInicio: string;
    horaFin: string;
  },
): Promise<JornadaDetalleApi> {
  const errHorario = mensajeErrorHorarioJornada(input.horaInicio, input.horaFin);
  if (errHorario) {
    throw new OperacionNegocioError("HORARIO_JORNADA_INVALIDO", errHorario);
  }

  const operationDate = parseFechaOperacion(input.fechaOperacion);
  const startTime = parseHora(input.horaInicio);
  const endTime = parseHora(input.horaFin);

  const unit = await prisma.unidadMovil.findFirst({
    where: { id: input.idUnidad, isActive: true },
  });
  if (!unit) {
    throw new OperacionNegocioError("UNIDAD_INVALIDA", "Unidad móvil no encontrada o inactiva.");
  }

  const seller = await prisma.vendedor.findFirst({
    where: { id: input.idVendedor, isActive: true },
  });
  if (!seller) {
    throw new OperacionNegocioError("VENDEDOR_INVALIDO", "Vendedor no encontrado o inactivo.");
  }

  const zone = await prisma.zona.findFirst({
    where: { id: input.idZona, isActive: true },
  });
  if (!zone) {
    throw new OperacionNegocioError("ZONA_INVALIDA", "Zona no encontrada o inactiva.");
  }

  const asignacion = await prisma.asignacionUnidadVendedor.findFirst({
    where: {
      unitId: input.idUnidad,
      sellerId: input.idVendedor,
      isCurrent: true,
    },
  });
  if (!asignacion) {
    throw new OperacionNegocioError(
      "ASIGNACION_UNIDAD_VENDEDOR",
      "El vendedor no tiene asignación vigente con esta unidad móvil.",
    );
  }

  const created = await prisma.jornada.create({
    data: {
      unitId: input.idUnidad,
      sellerId: input.idVendedor,
      zoneId: input.idZona,
      operationDate,
      startTime,
      endTime,
      status: JourneyStatus.PLANNED,
    },
    include: {
      unidad: { select: { id: true, code: true } },
      vendedor: { select: { id: true, fullName: true } },
      zona: { select: { id: true, name: true } },
    },
  });

  return {
    id: created.id,
    idUnidad: created.unitId,
    codigoUnidad: created.unidad.code,
    idVendedor: created.sellerId,
    nombreVendedor: created.vendedor.fullName,
    idZona: created.zoneId,
    nombreZona: created.zona.name,
    fechaOperacion: created.operationDate.toISOString().slice(0, 10),
    horaInicio: formatHora(created.startTime),
    horaFin: created.endTime ? formatHora(created.endTime) : null,
    estado: created.status,
    tieneAbastecimiento: false,
    idAbastecimiento: null,
  };
}

export type AbastecimientoLineaApi = {
  idProducto: string;
  codigo: string;
  nombre: string;
  cantidadEntregada: number;
};

export type AbastecimientoListaApi = {
  id: string;
  entregadoEn: string;
  estado: SupplyStatus;
  nota: string | null;
  idJornada: string;
  fechaOperacion: string;
  codigoUnidad: string;
  nombreVendedor: string;
  nombreZona: string;
};

export async function listarAbastecimientosPaginado(
  prisma: PrismaClient,
  opts: { skip: number; take: number; pagina: number; limite: number },
): Promise<{ total: number; data: AbastecimientoListaApi[]; paginacion: object }> {
  const [total, rows] = await Promise.all([
    prisma.abastecimiento.count(),
    prisma.abastecimiento.findMany({
      skip: opts.skip,
      take: opts.take,
      orderBy: { deliveredAt: "desc" },
      include: {
        jornada: {
          include: {
            unidad: { select: { code: true } },
            vendedor: { select: { fullName: true } },
            zona: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / opts.limite));
  const data: AbastecimientoListaApi[] = rows.map((s) => ({
    id: s.id,
    entregadoEn: s.deliveredAt.toISOString(),
    estado: s.status,
    nota: s.note,
    idJornada: s.journeyId,
    fechaOperacion: s.jornada.operationDate.toISOString().slice(0, 10),
    codigoUnidad: s.jornada.unidad.code,
    nombreVendedor: s.jornada.vendedor.fullName,
    nombreZona: s.jornada.zona.name,
  }));

  return {
    total,
    data,
    paginacion: {
      pagina: opts.pagina,
      limite: opts.limite,
      total,
      totalPaginas,
    },
  };
}

export type AbastecimientoDetalleApi = {
  id: string;
  entregadoEn: string;
  estado: SupplyStatus;
  nota: string | null;
  jornada: JornadaDetalleApi;
  lineas: AbastecimientoLineaApi[];
};

export async function obtenerAbastecimientoPorId(
  prisma: PrismaClient,
  id: string,
): Promise<AbastecimientoDetalleApi | null> {
  const s = await prisma.abastecimiento.findUnique({
    where: { id },
    include: {
      detalles: {
        include: {
          producto: { select: { id: true, code: true, name: true } },
        },
      },
      jornada: {
        include: {
          unidad: { select: { id: true, code: true } },
          vendedor: { select: { id: true, fullName: true } },
          zona: { select: { id: true, name: true } },
          abastecimientos: {
            where: { status: { not: SupplyStatus.CANCELLED } },
            take: 1,
            orderBy: { deliveredAt: "desc" },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!s) return null;

  const j = s.jornada;
  const sup = j.abastecimientos[0];
  const jornada: JornadaDetalleApi = {
    id: j.id,
    idUnidad: j.unitId,
    codigoUnidad: j.unidad.code,
    idVendedor: j.sellerId,
    nombreVendedor: j.vendedor.fullName,
    idZona: j.zoneId,
    nombreZona: j.zona.name,
    fechaOperacion: j.operationDate.toISOString().slice(0, 10),
    horaInicio: formatHora(j.startTime),
    horaFin: j.endTime ? formatHora(j.endTime) : null,
    estado: j.status,
    tieneAbastecimiento: Boolean(sup),
    idAbastecimiento: sup?.id ?? null,
  };

  const lineas: AbastecimientoLineaApi[] = s.detalles.map((d) => ({
    idProducto: d.productId,
    codigo: d.producto.code,
    nombre: d.producto.name,
    cantidadEntregada: Number(d.qtyGiven),
  }));

  return {
    id: s.id,
    entregadoEn: s.deliveredAt.toISOString(),
    estado: s.status,
    nota: s.note,
    jornada,
    lineas,
  };
}

type LineaInput = { idProducto: string; cantidad: number };

/**
 * Registra el abastecimiento diario: valida stock, descuenta almacén central, movimientos OUT,
 * detalle y cabecera; deja la jornada en EN_CURSO (HU5).
 */
export async function registrarAbastecimiento(
  prisma: PrismaClient,
  input: {
    idJornada: string;
    lineas: LineaInput[];
    nota?: string;
    entregadoEn?: string;
  },
  deliveredById: string,
): Promise<AbastecimientoDetalleApi> {
  const rawFh = input.entregadoEn?.trim() ?? "";
  const deliveredAt = rawFh.length > 0 ? new Date(rawFh) : new Date();
  if (rawFh.length > 0 && Number.isNaN(deliveredAt.getTime())) {
    throw new OperacionNegocioError("FECHA_ENTREGA_INVALIDA", "entregadoEn no es una fecha válida.");
  }

  const agregado = new Map<string, Prisma.Decimal>();
  for (const ln of input.lineas) {
    const q = new Prisma.Decimal(ln.cantidad);
    const prev = agregado.get(ln.idProducto) ?? new Prisma.Decimal(0);
    agregado.set(ln.idProducto, prev.add(q));
  }

  const supplyId = await prisma.$transaction(async (tx) => {
    const jornadaRow = await tx.jornada.findUnique({
      where: { id: input.idJornada },
      include: {
        abastecimientos: {
          where: { status: { not: SupplyStatus.CANCELLED } },
        },
      },
    });

    if (!jornadaRow) {
      throw new OperacionNegocioError("JORNADA_NO_ENCONTRADA", "Jornada no encontrada.");
    }
    if (jornadaRow.status !== JourneyStatus.PLANNED) {
      throw new OperacionNegocioError(
        "JORNADA_ESTADO_INVALIDO",
        "Solo se puede registrar abastecimiento en jornadas planificadas sin entrega previa.",
      );
    }
    if (jornadaRow.abastecimientos.length > 0) {
      throw new OperacionNegocioError(
        "ABASTECIMIENTO_YA_EXISTE",
        "Esta jornada ya tiene un abastecimiento registrado.",
      );
    }

    const warehouseId = await obtenerAlmacenCentralId(tx);

    const productIds = [...agregado.keys()];
    const products = await tx.producto.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (products.length !== productIds.length) {
      throw new OperacionNegocioError(
        "PRODUCTO_INVALIDO",
        "Uno o más productos no existen o están inactivos.",
      );
    }

    for (const [productId, need] of agregado) {
      const stock = await tx.inventarioAlmacen.findUnique({
        where: {
          warehouseId_productId: { warehouseId, productId },
        },
      });
      const current = stock?.currentQty ?? new Prisma.Decimal(0);
      if (!stock || current.lessThan(need)) {
        const p = products.find((x) => x.id === productId);
        throw new OperacionNegocioError(
          "STOCK_INSUFICIENTE",
          `Stock insuficiente para ${p?.code ?? productId}: se requiere ${need.toString()}, disponible ${current.toString()}.`,
        );
      }
    }

    const supply = await tx.abastecimiento.create({
      data: {
        journeyId: jornadaRow.id,
        warehouseId,
        deliveredById,
        deliveredAt,
        status: SupplyStatus.CLOSED,
        note: input.nota ?? null,
      },
    });

    for (const [productId, qty] of agregado) {
      await tx.detalleAbastecimiento.create({
        data: {
          supplyId: supply.id,
          productId,
          qtyGiven: qty,
        },
      });

      await tx.inventarioAlmacen.update({
        where: {
          warehouseId_productId: { warehouseId, productId },
        },
        data: { currentQty: { decrement: qty } },
      });

      await tx.movimientoInventario.create({
        data: {
          warehouseId,
          productId,
          userId: deliveredById,
          movementType: MovementType.OUT,
          quantity: qty,
          referenceType: ReferenceType.SUPPLY,
          referenceId: supply.id,
          note: input.nota ?? null,
          timestamp: deliveredAt,
        },
      });
    }

    await tx.jornada.update({
      where: { id: jornadaRow.id },
      data: { status: JourneyStatus.IN_PROGRESS },
    });

    return supply.id;
  });

  const detalle = await obtenerAbastecimientoPorId(prisma, supplyId);
  if (!detalle) {
    throw new Error("ABASTECIMIENTO_NO_RECUPERABLE");
  }
  return detalle;
}
