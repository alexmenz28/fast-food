/** Fila agregada con nombres de relaciones (lo que expone el adaptador de persistencia). */
export type ProductRow = {
  id: string;
  code: string;
  name: string;
  categoryId: number;
  categoryName: string;
  measureUnitId: number;
  measureUnitName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductoApiDto = {
  id: string;
  codigo: string;
  nombre: string;
  idCategoria: number;
  categoriaNombre: string;
  idUnidadMedida: number;
  unidadMedida: string;
  activo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
};

export function toProductoApiDto(row: ProductRow): ProductoApiDto {
  return {
    id: row.id,
    codigo: row.code,
    nombre: row.name,
    idCategoria: row.categoryId,
    categoriaNombre: row.categoryName,
    idUnidadMedida: row.measureUnitId,
    unidadMedida: row.measureUnitName,
    activo: row.isActive,
    creadoEn: row.createdAt,
    actualizadoEn: row.updatedAt,
  };
}

export type CrearProductoInput = {
  nombre: string;
  idCategoria: number;
  idUnidadMedida: number;
  activo?: boolean;
};

export type ActualizarProductoInput = {
  nombre: string;
  idCategoria: number;
  idUnidadMedida: number;
  isActive: boolean;
};
