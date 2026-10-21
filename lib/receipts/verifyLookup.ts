import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeReceiptNumber } from "@/lib/receipts/receiptNumber";

/**
 * Búsqueda pública de comprobantes para `/verify` (docs/08 §4.6; auditoría
 * 2026-10-20, H14).
 *
 * Un comprobante se puede referenciar de dos formas:
 * - `code`: el `verification_code` (UUID aleatorio, el que va en el QR y en
 *   el enlace). No se puede adivinar.
 * - `number`: el número impreso en el comprobante (`ER-2026-7K3QM-9XJ4A`,
 *   `ERR-` para renovaciones; los emitidos antes del Ciclo 47 tienen el formato
 *   viejo `ER-2026-586E51`). Es corto a propósito, para poder tipearlo a mano
 *   — por eso es una credencial MÁS DÉBIL que el código (el viejo, 24 bits; el
 *   nuevo, ~50), y la pantalla no lo presenta como prueba de autenticidad.
 *
 * Seguridad (la pantalla es pública, sin login):
 * - Por número se devuelve SOLO lo mínimo para confirmar que el comprobante
 *   existe y está vigente (estado, tipo, residencia, fecha de emisión). Los
 *   datos del estudiante (nombre con inicial, habitación, fechas) solo salen
 *   con el código completo, que es lo que lleva el QR. Así un barrido de
 *   números no permite juntar nombres de estudiantes por residencia.
 * - Nunca se devuelven montos, documentos ni datos de contacto
 *   (docs/08 §4.6). Se proyecta a mano campo por campo.
 * - Esta función no lista ni autocompleta: solo resuelve una referencia exacta.
 */

export type ReceiptReference = { kind: "code"; value: string } | { kind: "number"; value: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Interpreta lo que ingresó el usuario (o vino en la URL). `null` si no tiene forma de referencia. */
export function parseReceiptReference(raw: string | null | undefined): ReceiptReference | null {
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // dejar el texto tal cual
  }
  text = text.trim();
  if (text.length === 0 || text.length > 64) return null;

  if (UUID_RE.test(text)) return { kind: "code", value: text.toLowerCase() };

  // Formato viejo (ER-2026-586E51) y nuevo (ER-2026-7K3QM-9XJ4A): ver `normalizeReceiptNumber`.
  const number = normalizeReceiptNumber(text);
  return number ? { kind: "number", value: number } : null;
}

export type PublicReceiptStatus = "valid" | "voided" | "reissued";

export type PublicReceiptResult =
  /** `unavailable`: no se pudo consultar (error de base o servicio caído) — NO es "no existe". */
  | { found: false; unavailable?: boolean }
  | {
      found: true;
      receiptKind: "booking" | "renewal";
      status: PublicReceiptStatus;
      receiptNumber: string;
      issuedAt: string | null;
      residenceName: string | null;
      /** Solo presente cuando se buscó por código completo (QR/enlace). */
      detail: PublicReceiptDetail | null;
    };

export type PublicReceiptDetail = {
  studentLabel: string | null;
  roomType: string | null;
  desiredStartDate: string | null;
  initialDurationMonths: number | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  durationMonths: number | null;
};

type Payload = {
  student?: { first_name?: string; last_initial?: string };
  residence?: { name?: string };
  room_type?: string;
  desired_start_date?: string;
  initial_duration_months?: number;
  period_start_date?: string;
  period_end_date?: string;
  duration_months?: number;
};

function toPublicStatus(status: string): PublicReceiptStatus | null {
  if (status === "issued") return "valid";
  if (status === "voided") return "voided";
  if (status === "reissued") return "reissued";
  // not_available / pending_generation / generation_failed: todavía no es un comprobante verificable.
  return null;
}

/**
 * Resuelve la referencia en `booking_receipts` y, si no hay match, en
 * `renewal_receipts` (los números `ER-` y `ERR-` y los UUID nunca colisionan
 * entre tablas). Lee con el service role porque ninguna de las dos tablas
 * tiene policy para `anon` a propósito (migraciones 0011/0016).
 */
export async function lookupPublicReceipt(
  admin: SupabaseClient,
  reference: ReceiptReference,
): Promise<PublicReceiptResult> {
  const column = reference.kind === "code" ? "verification_code" : "receipt_number";

  const { data: booking, error: bookingError } = await admin
    .from("booking_receipts")
    .select("status, receipt_number, issued_at, receipt_payload, residences(name)")
    .eq(column, reference.value)
    .maybeSingle();
  if (bookingError) {
    console.error("[verify] booking_receipts lookup failed:", bookingError.code, bookingError.message);
    return { found: false, unavailable: true };
  }

  if (booking) {
    const status = toPublicStatus(booking.status as string);
    if (!status) return { found: false };
    const payload = (booking.receipt_payload ?? {}) as Payload;
    const residence = booking.residences as unknown as { name: string } | null;
    return {
      found: true,
      receiptKind: "booking",
      status,
      receiptNumber: booking.receipt_number as string,
      issuedAt: (booking.issued_at as string | null) ?? null,
      residenceName: residence?.name ?? payload.residence?.name ?? null,
      detail:
        reference.kind === "code"
          ? {
              studentLabel: studentLabel(payload),
              roomType: payload.room_type ?? null,
              desiredStartDate: payload.desired_start_date ?? null,
              initialDurationMonths: payload.initial_duration_months ?? null,
              periodStartDate: null,
              periodEndDate: null,
              durationMonths: null,
            }
          : null,
    };
  }

  const { data: renewal, error: renewalError } = await admin
    .from("renewal_receipts")
    .select("status, receipt_number, issued_at, receipt_payload")
    .eq(column, reference.value)
    .maybeSingle();
  if (renewalError) {
    console.error("[verify] renewal_receipts lookup failed:", renewalError.code, renewalError.message);
    return { found: false, unavailable: true };
  }
  if (!renewal) return { found: false };

  const status = toPublicStatus(renewal.status as string);
  if (!status) return { found: false };
  const payload = (renewal.receipt_payload ?? {}) as Payload;
  return {
    found: true,
    receiptKind: "renewal",
    status,
    receiptNumber: renewal.receipt_number as string,
    issuedAt: (renewal.issued_at as string | null) ?? null,
    residenceName: payload.residence?.name ?? null,
    detail:
      reference.kind === "code"
        ? {
            studentLabel: studentLabel(payload),
            roomType: null,
            desiredStartDate: null,
            initialDurationMonths: null,
            periodStartDate: payload.period_start_date ?? null,
            periodEndDate: payload.period_end_date ?? null,
            durationMonths: payload.duration_months ?? null,
          }
        : null,
  };
}

function studentLabel(payload: Payload): string | null {
  const label = [payload.student?.first_name, payload.student?.last_initial].filter(Boolean).join(" ");
  return label || null;
}
