import type { Producto } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  MeasureUnitPort,
  ProductCategoryPort,
  ProductRepositoryPort,
  ProductRow,
} from "@fastfood/catalogos-core";

type ProductoConRelaciones = Producto & {
  categoria: { name: string };
  unidadMedida: { name: string };
};

function mapRow(p: ProductoConRelaciones): ProductRow {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: p.categoria.name,
    measureUnitId: p.measureUnitId,
    measureUnitName: p.unidadMedida.name,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const includeRelations = {
  categoria: true,
  unidadMedida: true,
} as const;

export function createProductosPrismaPersistence(prisma: PrismaClient): {
  products: ProductRepositoryPort;
  categories: ProductCategoryPort;
  measureUnits: MeasureUnitPort;
} {
  const products: ProductRepositoryPort = {
    count: () => prisma.producto.count(),
    findManyPaged: async (skip, take) => {
      const rows = await prisma.producto.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: includeRelations,
      });
      return rows.map((p) => mapRow(p as ProductoConRelaciones));
    },
    findById: async (id) => {
      const p = await prisma.producto.findUnique({
        where: { id },
        include: includeRelations,
      });
      return p ? mapRow(p as ProductoConRelaciones) : null;
    },
    create: async (data) => {
      const p = await prisma.producto.create({
        data: {
          code: data.code,
          name: data.name,
          categoryId: data.categoryId,
          measureUnitId: data.measureUnitId,
          isActive: data.isActive,
        },
        include: includeRelations,
      });
      return mapRow(p as ProductoConRelaciones);
    },
    update: async (id, data) => {
      const p = await prisma.producto.update({
        where: { id },
        data: {
          name: data.name,
          categoryId: data.categoryId,
          measureUnitId: data.measureUnitId,
          isActive: data.isActive,
        },
        include: includeRelations,
      });
      return mapRow(p as ProductoConRelaciones);
    },
    softDelete: async (id) => {
      const p = await prisma.producto.update({
        where: { id },
        data: { isActive: false },
        include: includeRelations,
      });
      return mapRow(p as ProductoConRelaciones);
    },
    listAllCodes: async () => {
      const rows = await prisma.producto.findMany({ select: { code: true } });
      return rows.map((r) => r.code);
    },
  };

  const categories: ProductCategoryPort = {
    findActiveById: (id) =>
      prisma.categoriaProducto.findFirst({
        where: { id, isActive: true },
        select: { id: true, name: true },
      }),
    listActiveAlphabetical: () =>
      prisma.categoriaProducto.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
  };

  const measureUnits: MeasureUnitPort = {
    findActiveById: (id) =>
      prisma.unidadMedida.findFirst({
        where: { id, isActive: true },
        select: { id: true, name: true },
      }),
  };

  return { products, categories, measureUnits };
}
