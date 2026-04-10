import { describe, expect, it } from "vitest";
import { loginBodySchema } from "./auth.schemas.js";

describe("loginBodySchema", () => {
  it("acepta usuario y contraseña no vacíos", () => {
    expect(loginBodySchema.safeParse({ usuario: "ADMINISTRADOR", contrasena: "x" }).success).toBe(
      true,
    );
  });

  it("rechaza usuario vacío", () => {
    expect(loginBodySchema.safeParse({ usuario: "   ", contrasena: "x" }).success).toBe(false);
  });

  it("rechaza contraseña vacía", () => {
    expect(loginBodySchema.safeParse({ usuario: "u", contrasena: "" }).success).toBe(false);
  });
});
