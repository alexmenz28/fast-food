import type { PrismaClient } from "@prisma/client";
import { ProductosApplication } from "@fastfood/catalogos-core";
import { createProductosPrismaPersistence } from "../adapters/catalogos/prisma-productos.persistence.js";

export function createProductosApplication(prisma: PrismaClient): ProductosApplication {
  const { products, categories, measureUnits } =
    createProductosPrismaPersistence(prisma);
  return new ProductosApplication(products, categories, measureUnits);
}
