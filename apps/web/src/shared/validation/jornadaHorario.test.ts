import { describe, expect, it } from "vitest";
import { validarHorarioJornadaCliente } from "./jornadaHorario";

/**
 * Paridad con backend `mensajeErrorHorarioJornada`: el cliente debe bloquear los mismos casos antes del POST.
 */
describe("validarHorarioJornadaCliente", () => {
  it("null cuando 20:00 → 03:00", () => {
    expect(validarHorarioJornadaCliente("20:00", "03:00")).toBeNull();
  });

  it("error si fin fuera de ventana (04:00)", () => {
    expect(validarHorarioJornadaCliente("20:00", "04:00")).not.toBeNull();
  });

  it("error si inicio diurno (10:00)", () => {
    expect(validarHorarioJornadaCliente("10:00", "11:00")).not.toBeNull();
  });

  it("error si orden tarde invertido", () => {
    expect(validarHorarioJornadaCliente("23:00", "20:00")).not.toBeNull();
  });
});
