import * as jose from "jose";

const JWT_SECRET_RAW =
  process.env.JWT_SECRET ?? "desarrollo-cambie-JWT_SECRET-en-produccion-minimo-32-caracteres";

export const jwtSecretKey = new TextEncoder().encode(JWT_SECRET_RAW);

export async function firmarTokenJwt(payload: {
  role: string;
  usuario: string;
  nombreCompleto: string;
  sub: string;
}): Promise<string> {
  return new jose.SignJWT({
    role: payload.role,
    usuario: payload.usuario,
    nombreCompleto: payload.nombreCompleto,
  })
    .setSubject(payload.sub)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecretKey);
}
