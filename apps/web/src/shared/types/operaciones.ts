export type EstadoJornadaApi = "PLANNED" | "IN_PROGRESS" | "CLOSED" | "CANCELLED";

export type ZonaOpcion = { id: string; nombre: string };

export type JornadaResumen = {
  id: string;
  idUnidad: string;
  codigoUnidad: string;
  idVendedor: string;
  nombreVendedor: string;
  idZona: string;
  nombreZona: string;
  fechaOperacion: string;
  horaInicio: string;
  horaFin: string | null;
  estado: EstadoJornadaApi;
  tieneAbastecimiento: boolean;
  idAbastecimiento: string | null;
};

export type AbastecimientoResumen = {
  id: string;
  entregadoEn: string;
  estado: string;
  nota: string | null;
  idJornada: string;
  fechaOperacion: string;
  codigoUnidad: string;
  nombreVendedor: string;
  nombreZona: string;
};

export type AbastecimientoDetalle = {
  id: string;
  entregadoEn: string;
  estado: string;
  nota: string | null;
  jornada: JornadaResumen;
  lineas: { idProducto: string; codigo: string; nombre: string; cantidadEntregada: number }[];
};
