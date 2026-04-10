import { MovementType, Prisma, ReferenceType, type PrismaClient } from "@prisma/client";

/** Código del almacén central definido en seed (`ALM-01`). */
const CODIGO_ALMACEN_CENTRAL = "ALM-01";

/** Cliente Prisma o contexto de transacción: resolución del almacén central (HU4/HU5). */
export type ClienteAlmacen = Pick<PrismaClient, "almacen">;

export async function obtenerAlmacenCentralId(db: ClienteAlmacen): Promise<string> {
  const wh =
    (await db.almacen.findFirst({
      where: { isActive: true, code: CODIGO_ALMACEN_CENTRAL },
    })) ??
    (await db.almacen.findFirst({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }));
  if (!wh) {
    throw new Error("No hay almacén configurado en el sistema.");
  }
  return wh.id;
}

/**
 * Garantiza fila de stock en almacén central para un producto recién creado (cantidades en 0).
 * Idempotente si la fila ya existe.
 */
export async function asegurarFilaStockProducto(
  prisma: PrismaClient,
  productId: string,
): Promise<void> {
  const warehouseId = await obtenerAlmacenCentralId(prisma);
  await prisma.inventarioAlmacen.upsert({
    where: {
      warehouseId_productId: { warehouseId, productId },
    },
    create: {
      warehouseId,
      productId,
      currentQty: new Prisma.Decimal(0),
      minimumQty: new Prisma.Decimal(0),
    },
    update: {},
  });
}

export type FilaStockApi = {
  idProducto: string;
  codigo: string;
  nombre: string;
  idCategoria: number;
  categoriaNombre: string;
  unidadMedida: string;
  cantidadActual: number;
  cantidadMinima: number;
  bajoMinimo: boolean;
};

export async function listarStockPaginado(
  prisma: PrismaClient,
  opts: {
    warehouseId: string;
    idCategoria?: number;
    skip: number;
    take: number;
  },
): Promise<{ total: number; filas: FilaStockApi[] }> {
  const whereProduct: Prisma.ProductoWhereInput = { isActive: true };
  if (opts.idCategoria !== undefined) {
    whereProduct.categoryId = opts.idCategoria;
  }

  const [total, products] = await Promise.all([
    prisma.producto.count({ where: whereProduct }),
    prisma.producto.findMany({
      where: whereProduct,
      skip: opts.skip,
      take: opts.take,
      orderBy: { name: "asc" },
      include: {
        categoria: true,
        unidadMedida: true,
        inventarios: {
          where: { warehouseId: opts.warehouseId },
          take: 1,
        },
      },
    }),
  ]);

  const filas: FilaStockApi[] = products.map((p) => {
    const s = p.inventarios[0];
    const cantidadActual = s ? Number(s.currentQty) : 0;
    const cantidadMinima = s ? Number(s.minimumQty) : 0;
    return {
      idProducto: p.id,
      codigo: p.code,
      nombre: p.name,
      idCategoria: p.categoryId,
      categoriaNombre: p.categoria.name,
      unidadMedida: p.unidadMedida.name,
      cantidadActual,
      cantidadMinima,
      bajoMinimo: cantidadActual < cantidadMinima,
    };
  });

  return { total, filas };
}

export async function registrarIngreso(
  prisma: PrismaClient,
  input: {
    warehouseId: string;
    userId: string;
    productId: string;
    cantidad: number;
    fechaHora: Date;
    nota?: string;
  },
): Promise<FilaStockApi> {
  const product = await prisma.producto.findFirst({
    where: { id: input.productId, isActive: true },
    include: { categoria: true, unidadMedida: true },
  });
  if (!product) {
    throw new Error("PRODUCTO_INACTIVO_O_INEXISTENTE");
  }

  const qty = new Prisma.Decimal(input.cantidad);

  const row = await prisma.$transaction(async (tx) => {
    let stock = await tx.inventarioAlmacen.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });
    if (!stock) {
      stock = await tx.inventarioAlmacen.create({
        data: {
          warehouseId: input.warehouseId,
          productId: input.productId,
          currentQty: new Prisma.Decimal(0),
          minimumQty: new Prisma.Decimal(0),
        },
      });
    }

    await tx.inventarioAlmacen.update({
      where: { id: stock.id },
      data: { currentQty: { increment: qty } },
    });

    await tx.movimientoInventario.create({
      data: {
        warehouseId: input.warehouseId,
        productId: input.productId,
        userId: input.userId,
        movementType: MovementType.IN,
        quantity: qty,
        referenceType: ReferenceType.PURCHASE,
        note: input.nota ?? null,
        timestamp: input.fechaHora,
      },
    });

    return tx.inventarioAlmacen.findUniqueOrThrow({
      where: { id: stock.id },
      include: {
        producto: { include: { categoria: true, unidadMedida: true } },
      },
    });
  });

  const p = row.producto;
  const cantidadActual = Number(row.currentQty);
  const cantidadMinima = Number(row.minimumQty);
  return {
    idProducto: p.id,
    codigo: p.code,
    nombre: p.name,
    idCategoria: p.categoryId,
    categoriaNombre: p.categoria.name,
    unidadMedida: p.unidadMedida.name,
    cantidadActual,
    cantidadMinima,
    bajoMinimo: cantidadActual < cantidadMinima,
  };
}

export async function actualizarCantidadMinima(
  prisma: PrismaClient,
  input: {
    warehouseId: string;
    productId: string;
    cantidadMinima: number;
  },
): Promise<FilaStockApi> {
  const product = await prisma.producto.findFirst({
    where: { id: input.productId, isActive: true },
    include: { categoria: true, unidadMedida: true },
  });
  if (!product) {
    throw new Error("PRODUCTO_INACTIVO_O_INEXISTENTE");
  }

  const min = new Prisma.Decimal(input.cantidadMinima);

  const row = await prisma.$transaction(async (tx) => {
    let stock = await tx.inventarioAlmacen.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });
    if (!stock) {
      stock = await tx.inventarioAlmacen.create({
        data: {
          warehouseId: input.warehouseId,
          productId: input.productId,
          currentQty: new Prisma.Decimal(0),
          minimumQty: min,
        },
      });
    } else {
      stock = await tx.inventarioAlmacen.update({
        where: { id: stock.id },
        data: { minimumQty: min },
      });
    }
    return stock;
  });

  const cantidadActual = Number(row.currentQty);
  const cantidadMinima = Number(row.minimumQty);
  return {
    idProducto: product.id,
    codigo: product.code,
    nombre: product.name,
    idCategoria: product.categoryId,
    categoriaNombre: product.categoria.name,
    unidadMedida: product.unidadMedida.name,
    cantidadActual,
    cantidadMinima,
    bajoMinimo: cantidadActual < cantidadMinima,
  };
}

/** Expuesto para HU5: validar salida sin superar stock disponible. */
export async function obtenerCantidadDisponible(
  db: Pick<PrismaClient, "inventarioAlmacen">,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const stock = await db.inventarioAlmacen.findUnique({
    where: {
      warehouseId_productId: { warehouseId, productId },
    },
  });
  if (!stock) return 0;
  return Number(stock.currentQty);
}
