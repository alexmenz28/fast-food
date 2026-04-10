/** Error de reglas de negocio o validación cruzada (categoría/unidad activas, etc.). */
export class CatalogosValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogosValidationError";
  }
}

/** Producto inexistente para operaciones de actualización o baja. */
export class ProductoNotFoundError extends Error {
  constructor() {
    super("Registro no encontrado.");
    this.name = "ProductoNotFoundError";
  }
}
