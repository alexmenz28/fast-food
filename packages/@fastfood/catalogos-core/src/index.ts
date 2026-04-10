export { ProductosApplication } from "./application/productos.application.js";
export {
  CatalogosValidationError,
  ProductoNotFoundError,
} from "./domain/errors.js";
export type {
  ActualizarProductoInput,
  CrearProductoInput,
  ProductoApiDto,
  ProductRow,
} from "./domain/producto.js";
export { toProductoApiDto } from "./domain/producto.js";
export type {
  MeasureUnitPort,
  ProductCategoryPort,
  ProductRepositoryPort,
} from "./ports/productos.ports.js";
