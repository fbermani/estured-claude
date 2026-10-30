/** Reglas puras de la solicitud de vínculo y del código de casa (DR19). Sin Node: las usan también componentes de cliente. */

export const MAX_PENDING_LINK_REQUESTS = 3;
export const MAX_MISSING_RESIDENCE_REQUESTS = 3;
/** Sin 0/O/1/I/L para que se pueda dictar por teléfono o leer de un cartel. */
export const HOUSE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const HOUSE_CODE_LENGTH = 6;
export const LINK_REQUEST_MESSAGE_MAX = 280;

export type LinkRequestStatus = "pending" | "approved" | "rejected";
export const LINK_REQUEST_STATUS_LABELS: Record<LinkRequestStatus, string> = {
  pending: "Esperando a la residencia",
  approved: "Aprobada",
  rejected: "No aprobada",
};

/** Mayúsculas y sin espacios ni guiones; `null` si no tiene la forma de un código (no dice nada de si existe). */
export function normalizeHouseCode(raw: unknown): string | null {
  const code = String(raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  return new RegExp(`^[${HOUSE_CODE_ALPHABET}]{${HOUSE_CODE_LENGTH}}$`).test(code) ? code : null;
}

export type LinkRequestCheck = { ok: true } | { ok: false; error: string };

/** Frenos anti-spam: se evalúan con los datos que lee el servidor. */
export function checkCanRequestLink(params: { hasCurrentStay: boolean; pendingTotal: number; pendingInSameResidence: boolean }): LinkRequestCheck {
  if (params.hasCurrentStay) return { ok: false, error: "Ya tenés una estadía vinculada. Si cambiaste de residencia, avisá a Soporte." };
  if (params.pendingInSameResidence) return { ok: false, error: "Ya le mandaste una solicitud a esa residencia. Esperá su respuesta." };
  if (params.pendingTotal >= MAX_PENDING_LINK_REQUESTS) {
    return { ok: false, error: `Tenés ${MAX_PENDING_LINK_REQUESTS} solicitudes esperando respuesta. Esperá a que te respondan antes de mandar otra.` };
  }
  return { ok: true };
}

export function cleanShortText(raw: unknown, max: number): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  const cut = text.slice(0, max).trim();
  return cut ? cut : null;
}
