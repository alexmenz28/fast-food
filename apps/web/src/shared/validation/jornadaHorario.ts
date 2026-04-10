/**
 * Misma regla que el backend: turno nocturno 18:00–03:00 (caso FAST FOOD).
 */

const MINUTOS_INICIO_TARDE = 18 * 60;
const MINUTOS_FIN_TARDE = 23 * 60 + 59;
const MINUTOS_MAX_MADRUGADA = 3 * 60;
const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

function minutos(hhMm: string): number | null {
  const m = HH_MM.exec(hhMm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function enVentanaNocturna(t: number): boolean {
  return (t >= MINUTOS_INICIO_TARDE && t <= MINUTOS_FIN_TARDE) || (t >= 0 && t <= MINUTOS_MAX_MADRUGADA);
}

function tramoTarde(t: number): boolean {
  return t >= MINUTOS_INICIO_TARDE && t <= MINUTOS_FIN_TARDE;
}

function tramoMadrugada(t: number): boolean {
  return t >= 0 && t <= MINUTOS_MAX_MADRUGADA;
}

function ordenValido(s: number, e: number): boolean {
  if (tramoTarde(s) && tramoMadrugada(e)) return true;
  if (tramoTarde(s) && tramoTarde(e)) return e > s;
  if (tramoMadrugada(s) && tramoMadrugada(e)) return e >= s;
  return false;
}

/** Texto para ayuda en formularios. */
export const TEXTO_HORARIO_NOCTURNO =
  "Horario de operación nocturno permitido: de 18:00 a 03:00 (puede cruzar medianoche: ej. inicio 20:00, fin 03:00).";

export function validarHorarioJornadaCliente(horaInicio: string, horaFin: string): string | null {
  const s = minutos(horaInicio);
  const e = minutos(horaFin);
  if (s === null || e === null) {
    return "Indica hora de inicio y hora de fin en formato válido (HH:mm).";
  }
  if (!enVentanaNocturna(s)) {
    return "La hora de inicio debe estar entre 18:00 y 03:00.";
  }
  if (!enVentanaNocturna(e)) {
    return "La hora de fin estimada debe estar entre 18:00 y 03:00.";
  }
  if (!ordenValido(s, e)) {
    return "La hora de fin no es coherente con la de inicio dentro del turno nocturno (revise si cruza medianoche).";
  }
  return null;
}
