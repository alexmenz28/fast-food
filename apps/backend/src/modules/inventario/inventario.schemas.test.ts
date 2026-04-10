import { describe, expect, it } from "vitest";
import { inventarioIngresoSchema, inventarioMinimoSchema } from "./inventario.schemas.js";

const PID = "550e8400-e29b-41d4-a716-446655440099";

describe("inventarioIngresoSchema", () => {
  it("acepta cantidad positiva", () => {
    expect(
      inventarioIngresoSchema.safeParse({ idProducto: PID, cantidad: 10 }).success,
    ).toBe(true);
  });

  it("rechaza cantidad cero", () => {
    expect(
      inventarioIngresoSchema.safeParse({ idProducto: PID, cantidad: 0 }).success,
    ).toBe(false);
  });

  it("rechaza cantidad negativa", () => {
    expect(
      inventarioIngresoSchema.safeParse({ idProducto: PID, cantidad: -5 }).success,
    ).toBe(false);
  });

  it("rechaza idProducto no UUID", () => {
    expect(
      inventarioIngresoSchema.safeParse({ idProducto: "x", cantidad: 1 }).success,
    ).toBe(false);
  });
});

describe("inventarioMinimoSchema", () => {
  it("acepta cero y positivos", () => {
    expect(inventarioMinimoSchema.safeParse({ cantidadMinima: 0 }).success).toBe(true);
    expect(inventarioMinimoSchema.safeParse({ cantidadMinima: 100 }).success).toBe(true);
  });

  it("rechaza mínimo negativo", () => {
    expect(inventarioMinimoSchema.safeParse({ cantidadMinima: -1 }).success).toBe(false);
  });
});
