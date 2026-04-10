import type { ProductRow } from "../domain/producto.js";

export interface ProductRepositoryPort {
  count(): Promise<number>;
  findManyPaged(skip: number, take: number): Promise<ProductRow[]>;
  findById(id: string): Promise<ProductRow | null>;
  create(data: {
    code: string;
    name: string;
    categoryId: number;
    measureUnitId: number;
    isActive: boolean;
  }): Promise<ProductRow>;
  update(
    id: string,
    data: {
      name: string;
      categoryId: number;
      measureUnitId: number;
      isActive: boolean;
    },
  ): Promise<ProductRow>;
  softDelete(id: string): Promise<ProductRow>;
  listAllCodes(): Promise<string[]>;
}

export interface ProductCategoryPort {
  findActiveById(id: number): Promise<{ id: number; name: string } | null>;
  listActiveAlphabetical(): Promise<{ id: number; name: string }[]>;
}

export interface MeasureUnitPort {
  findActiveById(id: number): Promise<{ id: number; name: string } | null>;
}
