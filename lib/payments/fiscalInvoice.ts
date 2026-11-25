/**
 * Factura C manual del fee (LEG-002, Ola 0 legal): mientras no haya integración con TusFacturas, el admin emite la Factura C en ARCA
 * y registra acá su número. Módulo puro (sin base de datos) para validarlo y testearlo.
 *
 * Formato guardado: `PPPPP-NNNNNNNN` (punto de venta de 5 dígitos y número de 8), como lo imprime ARCA.
 */
export type FiscalInvoiceNumberResult = { ok: true; value: string } | { ok: false; error: string };

export function normalizeFacturaCNumber(raw: unknown): FiscalInvoiceNumberResult {
  const text = String(raw ?? "").trim();
  const match = /^(\d{1,5})\s*-\s*(\d{1,8})$/.exec(text);
  if (!match) return { ok: false, error: "Escribí el número como punto de venta y número, por ejemplo 00001-00000123." };
  const pos = Number(match[1]);
  const num = Number(match[2]);
  if (pos < 1) return { ok: false, error: "El punto de venta tiene que ser mayor que 0." };
  if (num < 1) return { ok: false, error: "El número de factura tiene que ser mayor que 0." };
  return { ok: true, value: `${String(pos).padStart(5, "0")}-${String(num).padStart(8, "0")}` };
}

/** Fecha de emisión `YYYY-MM-DD`: válida, no futura (en Buenos Aires) y no anterior al pago del fee. */
export function validateInvoiceDate(raw: unknown, paidAtIso: string | null, now: Date = new Date()): { ok: true; value: string } | { ok: false; error: string } {
  const value = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00-03:00`).getTime())) {
    return { ok: false, error: "Indicá la fecha de emisión de la factura." };
  }
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  if (value > today) return { ok: false, error: "La fecha de emisión no puede ser futura." };
  if (paidAtIso) {
    const paidDay = new Date(paidAtIso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    if (value < paidDay) return { ok: false, error: "La fecha de emisión no puede ser anterior al pago del fee." };
  }
  return { ok: true, value };
}
