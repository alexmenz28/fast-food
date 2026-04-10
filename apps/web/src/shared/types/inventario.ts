export type FilaStock = {
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

export type Paginacion = {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
};
