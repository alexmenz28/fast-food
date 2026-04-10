/**
 * Evita mostrar el mismo texto dos veces (p. ej. respuestas que concatenan el mismo mensaje).
 */
export function normalizarMensajeUsuario(texto: string): string {
  let t = texto.trim();
  if (!t) return t;

  /* Frases pegadas como "...03:00.La misma..." → separar para poder deduplicar. */
  t = t.replace(/\.([A-Za-zÁÉÍÓÚÜáéíóúüÑñ])/g, ". $1");

  const n = t.length;
  if (n >= 40 && n % 2 === 0) {
    const half = n / 2;
    if (t.slice(0, half) === t.slice(half)) {
      t = t.slice(0, half).trim();
    }
  }

  const partes = t
    .split(/\.\s+/)
    .map((p) => p.replace(/\.$/, "").trim())
    .filter(Boolean);
  if (partes.length <= 1) {
    return t.endsWith(".") || !t.includes(".") ? t : `${t}.`;
  }
  const unicas: string[] = [];
  for (const p of partes) {
    if (unicas.length === 0 || unicas[unicas.length - 1] !== p) {
      unicas.push(p);
    }
  }
  return unicas.map((p) => (p.endsWith(".") ? p : `${p}.`)).join(" ");
}
