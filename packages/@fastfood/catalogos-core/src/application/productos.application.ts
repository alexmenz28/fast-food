import {
  CatalogosValidationError,
  ProductoNotFoundError,
} from "../domain/errors.js";
import type {
  ActualizarProductoInput,
  CrearProductoInput,
  ProductoApiDto,
} from "../domain/producto.js";
import { toProductoApiDto } from "../domain/producto.js";
import type {
  MeasureUnitPort,
  ProductCategoryPort,
  ProductRepositoryPort,
} from "../ports/productos.ports.js";

export class ProductosApplication {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly categories: ProductCategoryPort,
    private readonly measureUnits: MeasureUnitPort,
  ) {}

  async listCategoriasActivas(): Promise<{ id: number; name: string }[]> {
    return this.categories.listActiveAlphabetical();
  }

  async listProductos(paginacion: {
    skip: number;
    take: number;
    pagina: number;
    limite: number;
  }): Promise<{
    data: ProductoApiDto[];
    paginacion: {
      pagina: number;
      limite: number;
      total: number;
      totalPaginas: number;
    };
  }> {
    const [total, rows] = await Promise.all([
      this.products.count(),
      this.products.findManyPaged(paginacion.skip, paginacion.take),
    ]);
    const totalPaginas = Math.max(1, Math.ceil(total / paginacion.limite));
    return {
      data: rows.map(toProductoApiDto),
      paginacion: {
        pagina: paginacion.pagina,
        limite: paginacion.limite,
        total,
        totalPaginas,
      },
    };
  }

  async crear(input: CrearProductoInput): Promise<ProductoApiDto> {
    const categoria = await this.categories.findActiveById(input.idCategoria);
    if (!categoria) {
      throw new CatalogosValidationError(
        "Categoría de producto no encontrada o inactiva.",
      );
    }
    const unidad = await this.measureUnits.findActiveById(input.idUnidadMedida);
    if (!unidad) {
      throw new CatalogosValidationError(
        "Unidad de medida no encontrada o inactiva.",
      );
    }
    const code = await this.generarCodigoProducto();
    const row = await this.products.create({
      code,
      name: input.nombre,
      categoryId: categoria.id,
      measureUnitId: input.idUnidadMedida,
      isActive: input.activo ?? true,
    });
    return toProductoApiDto(row);
  }

  async actualizar(
    id: string,
    input: ActualizarProductoInput,
  ): Promise<ProductoApiDto> {
    if (!(await this.products.findById(id))) {
      throw new ProductoNotFoundError();
    }
    const categoria = await this.categories.findActiveById(input.idCategoria);
    if (!categoria) {
      throw new CatalogosValidationError(
        "Categoría de producto no encontrada o inactiva.",
      );
    }
    const unidad = await this.measureUnits.findActiveById(input.idUnidadMedida);
    if (!unidad) {
      throw new CatalogosValidationError(
        "Unidad de medida no encontrada o inactiva.",
      );
    }
    const row = await this.products.update(id, {
      name: input.nombre,
      categoryId: categoria.id,
      measureUnitId: input.idUnidadMedida,
      isActive: input.isActive,
    });
    return toProductoApiDto(row);
  }

  async bajaLogica(id: string): Promise<ProductoApiDto> {
    const existing = await this.products.findById(id);
    if (!existing) {
      throw new ProductoNotFoundError();
    }
    const row = await this.products.softDelete(id);
    return toProductoApiDto(row);
  }

  /**
   * Códigos estilo P001, P002… sin colisionar; tolera códigos fuera de patrón vía Set de ocupados.
   */
  private async generarCodigoProducto(): Promise<string> {
    const codes = await this.products.listAllCodes();
    const ocupados = new Set(codes.map((c) => c.trim().toUpperCase()));
    let max = 0;
    for (const code of codes) {
      const m = /^P(\d+)$/i.exec(code.trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    for (let n = max + 1; n < max + 10000; n++) {
      const next = `P${String(n).padStart(3, "0")}`;
      if (!ocupados.has(next.toUpperCase())) return next;
    }
    throw new Error("No se pudo generar codigo de producto");
  }
}
