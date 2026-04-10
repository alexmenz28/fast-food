export type UnidadMedidaOpt = {
  id: number;
  codigo: string;
  nombre: string;
};

/** Opciones del select de categorías (GET /v1/productos/categorias). */
export type CategoriaProductoOpt = {
  id: number;
  nombre: string;
};

export type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  /** FK a `categoria_producto`; el nombre legible viene en `categoriaNombre`. */
  idCategoria: number;
  categoriaNombre: string;
  idUnidadMedida: number;
  unidadMedida: string;
  activo: boolean;
};

export type Vendedor = {
  id: string;
  nombreCompleto: string;
  documento: string;
  telefono: string;
  activo: boolean;
};

/** Opción de estado operativo (GET /v1/unidades-moviles/estados). */
export type EstadoUnidadMovilOpt = {
  id: number;
  codigo: string;
  nombre: string;
};

export type UnidadMovil = {
  id: string;
  codigo: string;
  placa: string;
  /** Notas internas (opcional). La zona operativa oficial de cada salida es la de la jornada (`idZona` en abastecimiento). */
  descripcion: string | null;
  idEstadoOperativo: number;
  estadoCodigo: string;
  estadoNombre: string;
  idVendedor: string | null;
  asignacionFechaInicio: string | null;
  asignacionFechaFin: string | null;
  activo: boolean;
};

export type Paginacion = {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
};

export type ModalEdicion =
  | { kind: "producto"; item: Producto }
  | { kind: "vendedor"; item: Vendedor }
  | { kind: "unidad"; item: UnidadMovil }
  | null;
