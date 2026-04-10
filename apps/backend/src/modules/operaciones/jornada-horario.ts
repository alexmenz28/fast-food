/**
 * Política operativa FAST FOOD (caso de estudio): turno nocturno 18:00–03:00 (cruza medianoche).
 * Inicio suele ser por la tarde (18:00–23:59); cierre habitual hacia la madrugada (00:00–03:00).
 */

export const MINUTOS_INICIO_TARDE = 18 * 60;
export const MINUTOS_FIN_TARDE = 23 * 60 + 59;
/** 03:00 inclusive */
export const MINUTOS_MAX_MADRUGADA = 3 * 60;

/** Algunos navegadores envían HH:mm:ss en type=time; solo usamos hora y minuto. */
const HH_MM = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function minutosDesdeMedianoche(hhMm: string): number | null {
  const m = HH_MM.exec(hhMm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function enVentanaNocturna(minutos: number): boolean {
  return (
    (minutos >= MINUTOS_INICIO_TARDE && minutos <= MINUTOS_FIN_TARDE) ||
    (minutos >= 0 && minutos <= MINUTOS_MAX_MADRUGADA)
  );
}

function tramoTarde(minutos: number): boolean {
  return minutos >= MINUTOS_INICIO_TARDE && minutos <= MINUTOS_FIN_TARDE;
}

function tramoMadrugada(minutos: number): boolean {
  return minutos >= 0 && minutos <= MINUTOS_MAX_MADRUGADA;
}

/** Orden válido dentro del mismo “turno que cruza medianoche”. */
export function ordenHorarioJornadaValido(startMin: number, endMin: number): boolean {
  const startTarde = tramoTarde(startMin);
  const startMad = tramoMadrugada(startMin);
  const endTarde = tramoTarde(endMin);
  const endMad = tramoMadrugada(endMin);

  if (startTarde && endMad) return true;
  if (startTarde && endTarde) return endMin > startMin;
  if (startMad && endMad) return endMin >= startMin;
  return false;
}

export function mensajeErrorHorarioJornada(horaInicio: string, horaFin: string): string | null {
  const s = minutosDesdeMedianoche(horaInicio);
  const e = minutosDesdeMedianoche(horaFin);
  if (s === null || e === null) {
    return "Las horas deben tener formato HH:mm (24 h).";
  }
  if (!enVentanaNocturna(s)) {
    return "La hora de inicio debe estar entre 18:00 y 03:00 (horario nocturno de operación).";
  }
  if (!enVentanaNocturna(e)) {
    return "La hora de fin estimada debe estar entre 18:00 y 03:00 (horario nocturno de operación).";
  }
  if (!ordenHorarioJornadaValido(s, e)) {
    return "La hora de fin debe ser coherente con la de inicio: si ambas son por la tarde, fin debe ser posterior; si el turno cruza medianoche, inicio por la tarde y fin hasta 03:00; si ambas son madrugada, fin no puede ser anterior a inicio.";
  }
  return null;
}
