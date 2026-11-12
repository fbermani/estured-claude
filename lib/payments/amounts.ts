/** Topes razonables para montos informados a mano (pago a la residencia). Valores de borde: la base solo exige >= 0. */
export const MAX_AMOUNT_ARS = 1_000_000_000;
export const MAX_AMOUNT_USD = 1_000_000;

export type ParsedAmount = { ok: true; value: number | null } | { ok: false; error: string };

/** Monto opcional: vacío/0 -> `null`; si viene, debe ser un número finito, no negativo y menor o igual al tope. */
export function parseOptionalAmount(raw: unknown, max: number, label: string): ParsedAmount {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: true, value: null };
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: `El monto en ${label} no es válido. Ingresá un número mayor o igual a 0.` };
  if (n > max) return { ok: false, error: `El monto en ${label} es demasiado alto. Revisalo.` };
  return { ok: true, value: n === 0 ? null : n };
}
