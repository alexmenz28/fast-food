import { describe, expect, it } from "vitest";
import { mensajeErrorHorarioJornada } from "./jornada-horario.js";

describe("mensajeErrorHorarioJornada (turno nocturno 18:00–03:00)", () => {
  it("acepta cruce medianoche típico 20:00 → 03:00", () => {
    expect(mensajeErrorHorarioJornada("20:00", "03:00")).toBeNull();
  });

  it("acepta inicio al límite 18:00 y fin 03:00", () => {
    expect(mensajeErrorHorarioJornada("18:00", "03:00")).toBeNull();
  });

  it("acepta solo tarde con fin posterior (22:00 → 23:30)", () => {
    expect(mensajeErrorHorarioJornada("22:00", "23:30")).toBeNull();
  });

  it("acepta solo madrugada coherente (01:00 → 03:00)", () => {
    expect(mensajeErrorHorarioJornada("01:00", "03:00")).toBeNull();
  });

  it("acepta hora con segundos (formato navegador)", () => {
    expect(mensajeErrorHorarioJornada("20:00:00", "03:00:00")).toBeNull();
  });

  it("rechaza inicio antes de 18:00 (ej. 17:00)", () => {
    expect(mensajeErrorHorarioJornada("17:00", "22:00")).not.toBeNull();
  });

  it("rechaza fin después de 03:00 (ej. 04:00)", () => {
    expect(mensajeErrorHorarioJornada("20:00", "04:00")).not.toBeNull();
  });

  it("rechaza orden tarde invertido (23:00 → 20:00)", () => {
    expect(mensajeErrorHorarioJornada("23:00", "20:00")).not.toBeNull();
  });

  it("rechaza madrugada invertida (03:00 → 01:00)", () => {
    expect(mensajeErrorHorarioJornada("03:00", "01:00")).not.toBeNull();
  });

  it("rechaza formato inválido", () => {
    expect(mensajeErrorHorarioJornada("25:00", "03:00")).not.toBeNull();
    expect(mensajeErrorHorarioJornada("xx", "03:00")).not.toBeNull();
  });
});
