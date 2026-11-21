import { PAYMENT_METHOD_KEYS, isPaymentMethodKey, paymentMethodLabel, type Checked, type PaymentMethodKey } from "@/lib/payments/paymentMethods";
import { effectiveReservationModes } from "@/lib/residences/reservationCollection";

/**
 * Qué le muestra la solicitud al estudiante sobre cómo se cobra la reserva (DR63 (c), `docs/00`). Lógica PURA, sin `server-only`:
 * la usan la ficha (servidor), el formulario (cliente) y la acción de envío (validación), y los tests.
 *
 * Nunca lleva datos de cobro: solo claves y nombres de medio. Los datos se muestran más adelante, cuando la residencia habilita el
 * pago de esa solicitud (DR63 (d)).
 */

export interface OfferedPaymentMethod {
  key: PaymentMethodKey;
  /** Nombre para mostrar. En «Otro», el nombre APROBADO (nunca el pendiente). */
  label: string;
}

/**
 * - `methods`: la residencia cobra con medios habilitados y hay al menos uno con datos APROBADOS: el estudiante puede elegir uno como
 *   preferencia (no vinculante).
 * - `contact`: contacto directo, residencia sin configurar o sin medios aprobados todavía. La residencia se comunica con quien
 *   corresponda (el estudiante, o su familiar vinculado si es menor).
 */
export type ReservationCollectionOffer = { kind: "methods"; methods: OfferedPaymentMethod[] } | { kind: "contact" };

export const CONTACT_OFFER: ReservationCollectionOffer = { kind: "contact" };

/** Fila de `residence_collection_accounts` con datos aprobados, reducida a lo que esta lógica necesita (sin `details`). */
export interface ApprovedCollectionMethod {
  methodKey: string;
  /** `method_label` aprobado (solo importa en «Otro»). */
  methodLabel: string | null;
}

/**
 * Arma la oferta. Un medio se ofrece solo si la residencia lo acepta (`accepted_payment_methods`) Y sus datos de cobro están
 * aprobados (DR63 (j) 5). El orden es el del catálogo. «Otro» exige un nombre aprobado. Si `enabled_methods` está activo pero ningún
 * medio califica, se degrada a `contact` (no se muestra una lista vacía). Con ambas opciones activas se ofrecen los medios: la
 * residencia elige el camino por solicitud al aceptarla.
 */
export function offeredReservationCollection(input: {
  modes: readonly string[] | null | undefined;
  acceptedMethods: readonly string[] | null | undefined;
  approved: readonly ApprovedCollectionMethod[];
}): ReservationCollectionOffer {
  if (!effectiveReservationModes(input.modes).includes("enabled_methods")) return CONTACT_OFFER;
  const accepted = new Set((input.acceptedMethods ?? []).filter(isPaymentMethodKey));
  const approvedByKey = new Map<string, string | null>();
  for (const a of input.approved) approvedByKey.set(a.methodKey, a.methodLabel);
  const methods: OfferedPaymentMethod[] = [];
  for (const key of PAYMENT_METHOD_KEYS) {
    if (!accepted.has(key) || !approvedByKey.has(key)) continue;
    const customLabel = approvedByKey.get(key) ?? null;
    if (key === "other" && (customLabel ?? "").trim().length === 0) continue;
    methods.push({ key, label: paymentMethodLabel(key, customLabel) });
  }
  return methods.length > 0 ? { kind: "methods", methods } : CONTACT_OFFER;
}

/**
 * Valida el campo `preferred_payment_method` del envío (opcional, no vinculante). Devuelve la clave a guardar o `null`.
 *  - Vacío o ausente («Lo coordino con la residencia»): `null`.
 *  - Algo que no es una clave del catálogo: error (formulario adulterado o roto).
 *  - Clave válida del catálogo que YA NO se ofrece (la residencia cambió la configuración entre que se abrió la ficha y se envió, o
 *    la oferta es `contact`): `null`, sin error. La preferencia no obliga a nadie y no tiene sentido frenar el envío por eso.
 */
export function resolvePreferredPaymentMethod(raw: unknown, offer: ReservationCollectionOffer): Checked<PaymentMethodKey | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "El medio de pago elegido no es válido. Recargá la página e intentá de nuevo." };
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  if (!isPaymentMethodKey(value)) return { ok: false, error: "El medio de pago elegido no es válido. Recargá la página e intentá de nuevo." };
  if (offer.kind !== "methods") return { ok: true, value: null };
  return { ok: true, value: offer.methods.some((m) => m.key === value) ? value : null };
}

/** Texto cuando la residencia coordina el cobro por su cuenta. Con un menor, el contacto es siempre con el familiar vinculado (DR63 (m)). */
export function contactCollectionNotice(isMinor: boolean): string {
  return isMinor
    ? "La residencia le va a escribir a tu familiar vinculado para coordinar el pago de la reserva."
    : "La residencia te va a escribir para coordinar el pago de la reserva.";
}

/**
 * Línea bajo los chips. No promete datos de pago al estudiante: con ambas opciones activas la residencia puede elegir el contacto
 * directo, y con un menor los datos de cobro los ve el familiar pagador (DR63 (j) 3 y (m)).
 */
export function methodsPreferenceNotice(isMinor: boolean): string {
  return isMinor
    ? "Si la residencia acepta la solicitud, le indica a tu familiar vinculado cómo pagar."
    : "Si la residencia acepta tu solicitud, te indica cómo pagar.";
}

/** Responsabilidad y seguridad (DR63 (g), `docs/10` §14.5). Un solo texto, para que el formulario y los tests usen el mismo. */
export const COLLECTION_LIABILITY_NOTICE =
  "EstuRed no custodia fondos ni se responsabiliza por el pago ni por el medio elegido. No transfieras dinero a datos que no llegaron por tu solicitud.";

export const COLLECTION_PREFERENCE_NOTICE = "Tu elección no obliga a la residencia.";
export const COLLECTION_COORDINATE_LABEL = "Lo coordino con la residencia";
export const COLLECTION_SECTION_TITLE = "Cómo te van a cobrar la reserva";
