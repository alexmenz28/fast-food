import { describe, expect, it } from "vitest";
import {
  abastecimientoRegistrarSchema,
  jornadaCrearSchema,
} from "./operaciones.schemas.js";

const U1 = "550e8400-e29b-41d4-a716-446655440001";
const U2 = "550e8400-e29b-41d4-a716-446655440002";
const U3 = "550e8400-e29b-41d4-a716-446655440003";

function bodyJornada(over: Record<string, unknown> = {}) {
  return {
    idUnidad: U1,
    idVendedor: U2,
    idZona: U3,
    fechaOperacion: "2026-03-31",
    horaInicio: "20:00",
    horaFin: "03:00",
    ...over,
  };
}

describe("jornadaCrearSchema", () => {
  it("acepta payload válido", () => {
    const r = jornadaCrearSchema.safeParse(bodyJornada());
    expect(r.success).toBe(true);
  });

  it("acepta HH:mm:ss (sin pasar de 03:00 en segundos)", () => {
    const r = jornadaCrearSchema.safeParse(
      bodyJornada({ horaInicio: "20:00:00", horaFin: "03:00:00" }),
    );
    expect(r.success).toBe(true);
  });

  it("rechaza hora fuera de ventana nocturna", () => {
    const r = jornadaCrearSchema.safeParse(bodyJornada({ horaFin: "04:00" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = [...new Set(r.error.issues.map((i) => i.message))];
      expect(msgs.length).toBe(1);
    }
  });

  it("rechaza inicio diurno inválido", () => {
    const r = jornadaCrearSchema.safeParse(bodyJornada({ horaInicio: "10:00", horaFin: "11:00" }));
    expect(r.success).toBe(false);
  });

  it("rechaza orden incoherente misma tarde", () => {
    const r = jornadaCrearSchema.safeParse(
      bodyJornada({ horaInicio: "22:00", horaFin: "20:00" }),
    );
    expect(r.success).toBe(false);
  });

  it("rechaza UUID mal formado", () => {
    const r = jornadaCrearSchema.safeParse(bodyJornada({ idUnidad: "no-uuid" }));
    expect(r.success).toBe(false);
  });

  it("rechaza fecha que no es YYYY-MM-DD", () => {
    const r = jornadaCrearSchema.safeParse(bodyJornada({ fechaOperacion: "31-03-2026" }));
    expect(r.success).toBe(false);
  });
});

describe("abastecimientoRegistrarSchema", () => {
  it("acepta líneas válidas", () => {
    const r = abastecimientoRegistrarSchema.safeParse({
      idJornada: U1,
      lineas: [{ idProducto: U2, cantidad: 1.5 }],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza sin líneas", () => {
    const r = abastecimientoRegistrarSchema.safeParse({
      idJornada: U1,
      lineas: [],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza cantidad cero o negativa", () => {
    expect(
      abastecimientoRegistrarSchema.safeParse({
        idJornada: U1,
        lineas: [{ idProducto: U2, cantidad: 0 }],
      }).success,
    ).toBe(false);
    expect(
      abastecimientoRegistrarSchema.safeParse({
        idJornada: U1,
        lineas: [{ idProducto: U2, cantidad: -1 }],
      }).success,
    ).toBe(false);
  });
});
