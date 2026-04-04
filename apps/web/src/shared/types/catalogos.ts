export type UnidadMedidaOpt = {
  id: number;
  codigo: string;
  nombre: string;
};

export type Producto = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: "ALIMENTO" | "BEBIDA" | "INSUMO";
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

export type UnidadMovil = {
  id: string;
  codigo: string;
  zona: string;
  estado: "ACTIVA" | "MANTENIMIENTO" | "FUERA_DE_SERVICIO";
  idVendedor: string | null;
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
