import type { EstadoJornadaApi } from "../types/operaciones";

export function etiquetaEstadoJornada(estado: EstadoJornadaApi): string {
  switch (estado) {
    case "PLANNED":
      return "Planificada";
    case "IN_PROGRESS":
      return "En curso";
    case "CLOSED":
      return "Cerrada";
    case "CANCELLED":
      return "Cancelada";
    default:
      return estado;
  }
}

export function etiquetaEstadoAbastecimiento(estado: string): string {
  switch (estado) {
    case "OPEN":
      return "Abierto";
    case "CLOSED":
      return "Cerrado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return estado;
  }
}
