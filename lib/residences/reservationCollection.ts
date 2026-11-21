import { isPaymentMethodKey, paymentMethodLabel, type Checked } from "@/lib/payments/paymentMethods";

/**
 * Configuración del «Cobro de la reserva» de una residencia (DR63, `docs/00`). Lógica PURA, sin `server-only`: la usan el servidor
 * (guardado y gate de «Enviar para revisión»), el formulario del perfil (checklist en vivo) y los tests.
 *
 * Dos opciones, activables a la vez:
 *  - `enabled_methods`: «Cobro con medios habilitados» (medios del catálogo + datos de cobro cargados una vez).
 *  - `whatsapp_direct`: «Contacto directo por WhatsApp» (la residencia escribe al estudiante; no pide ningún dato extra).
 */

export const RESERVATION_PAYMENT_MODES = ["enabled_methods", "whatsapp_direct"] as const;
export type ReservationPaymentMode = (typeof RESERVATION_PAYMENT_MODES)[number];

export const RESERVATION_MODE_LABELS: Record<ReservationPaymentMode, string> = {
  enabled_methods: "Cobro con medios habilitados",
  whatsapp_direct: "Contacto directo por WhatsApp",
};

export function isReservationPaymentMode(value: unknown): value is ReservationPaymentMode {
  return typeof value === "string" && (RESERVATION_PAYMENT_MODES as readonly string[]).includes(value);
}

/**
 * Valida las opciones elegidas al guardar: arreglo con 1 o 2 opciones válidas, sin repetidas. Devuelve el orden canónico.
 * Guardar sin ninguna opción no existe: «sin configurar» solo es el estado de una residencia que nunca eligió.
 */
export function normalizeReservationModes(input: unknown): Checked<ReservationPaymentMode[]> {
  if (!Array.isArray(input)) return { ok: false, error: "Las opciones de cobro no son válidas." };
  const seen = new Set<string>();
  for (const item of input) {
    if (!isReservationPaymentMode(item)) return { ok: false, error: "Hay una opción de cobro que no existe." };
    if (seen.has(item)) return { ok: false, error: "Una opción de cobro está repetida." };
    seen.add(item);
  }
  if (seen.size === 0) return { ok: false, error: "Elegí al menos una opción para cobrar la reserva." };
  return { ok: true, value: RESERVATION_PAYMENT_MODES.filter((m) => seen.has(m)) };
}

/**
 * Opciones EFECTIVAS (lo que usa el flujo de solicitudes en las fases siguientes). Una residencia sin configurar (`null` o vacío)
 * se trata como «Contacto directo por WhatsApp», que es el comportamiento de hoy (DR63 (k)). Ignora valores inválidos.
 * OJO: NO sirve para el requisito 10 de «Enviar para revisión», que exige haber elegido: ver `evaluateCollectionRequirement`.
 */
export function effectiveReservationModes(stored: readonly string[] | null | undefined): ReservationPaymentMode[] {
  const valid = RESERVATION_PAYMENT_MODES.filter((m) => (stored ?? []).includes(m));
  return valid.length > 0 ? valid : ["whatsapp_direct"];
}

/** Opciones elegidas de verdad (sin el valor por defecto): `[]` = sin configurar. */
export function explicitReservationModes(stored: readonly string[] | null | undefined): ReservationPaymentMode[] {
  return RESERVATION_PAYMENT_MODES.filter((m) => (stored ?? []).includes(m));
}

/** Estado de los datos de cobro de un medio, para la pantalla del dueño. */
export type MethodDataState = "none" | "pending" | "approved" | "rejected";

/**
 * «Pendiente de aprobación»: hay datos o nombre nuevos a la espera del admin (siguen rigiendo los aprobados). «Rechazado»: el admin
 * rechazó el último cambio y no hay nada pendiente (rigen los aprobados, si hay; si no, el medio no tiene datos). «Aprobado»: hay datos
 * aprobados y nada pendiente. «Sin datos»: no hay ninguno. Para «Otro», el nombre pendiente cuenta como pendiente.
 * `rejected` lo calcula quien lee el historial de auditoría (solo la pantalla del dueño): sin él, nunca se devuelve «Rechazado».
 */
export function methodDataState(
  row: { details: string | null; pendingDetails: string | null; pendingMethodLabel?: string | null } | null | undefined,
  options: { rejected?: boolean } = {},
): MethodDataState {
  if (!row) return "none";
  const hasPending = (row.pendingDetails ?? "").trim().length > 0 || (row.pendingMethodLabel ?? "").trim().length > 0;
  if (hasPending) return "pending";
  if (options.rejected) return "rejected";
  return (row.details ?? "").trim().length > 0 ? "approved" : "none";
}

export const METHOD_DATA_STATE_LABELS: Record<MethodDataState, string> = {
  none: "Sin datos",
  pending: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
};

/** Lo que el chequeo del requisito 10 necesita saber de la residencia. */
export interface ReservationCollectionConfig {
  /** `residences.reservation_payment_modes` tal como está guardado (`null`/vacío = sin configurar). */
  modes: readonly string[] | null;
  /** `residences.accepted_payment_methods` tal como está guardado. */
  acceptedMethods: readonly string[] | null;
  /**
   * Claves de medios con datos de cobro cargados: APROBADOS o PENDIENTES. Supuesto reversible: para ENVIAR a revisión alcanza con que el
   * dueño haya cargado los datos, porque la primera carga la aprueba el admin al verificar la residencia (DR63 (j) 5). Que el medio se
   * OFREZCA al estudiante exige `details` aprobados: eso es de las fases siguientes, no de este chequeo. En «Otro» cuenta además que
   * haya un nombre (aprobado o pendiente); eso lo resuelve quien arma esta lista.
   */
  methodsWithData: readonly string[];
}

export interface CollectionRequirement {
  ok: boolean;
  /** Qué falta, accionable y en voseo (solo si `ok` es falso). */
  hint?: string;
  /** 0 a 1, para la barra de fortaleza. */
  progress: number;
}

const joinList = (parts: string[]): string => (parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`);

/**
 * Requisito 10 de «Enviar para revisión» (DR59/DR63): válido si
 *  - eligió «Contacto directo por WhatsApp» (no pide nada más), o
 *  - eligió «Cobro con medios habilitados» con al menos 1 medio aceptado y los datos de cobro de CADA medio aceptado cargados
 *    (supuesto: es la versión de `docs/06` §8.8, «cada clave aceptada tiene su fila con datos completos»; incluye el nombre de «Otro»).
 * Sin ninguna opción elegida (`null` o vacío) NO cumple: la residencia ya publicada se trata como contacto directo en el flujo, pero
 * igual tiene que elegir para enviar (DR63 (k)).
 */
export function evaluateCollectionRequirement(config: ReservationCollectionConfig): CollectionRequirement {
  const modes = explicitReservationModes(config.modes);
  if (modes.length === 0) {
    return { ok: false, hint: "Elegí cómo cobrás la reserva: con medios habilitados o con contacto directo por WhatsApp.", progress: 0 };
  }
  if (modes.includes("whatsapp_direct")) return { ok: true, progress: 1 };

  const accepted = (config.acceptedMethods ?? []).filter((k) => isPaymentMethodKey(k));
  if (accepted.length === 0) return { ok: false, hint: "Elegí al menos un medio de cobro y cargá sus datos.", progress: 0.3 };
  const withData = new Set(config.methodsWithData);
  const missing = accepted.filter((k) => !withData.has(k));
  if (missing.length > 0) {
    const names = joinList(missing.map((k) => paymentMethodLabel(k)));
    return {
      ok: false,
      hint: `Cargá los datos de cobro de ${names}.`,
      progress: 0.3 + 0.6 * ((accepted.length - missing.length) / accepted.length),
    };
  }
  return { ok: true, progress: 1 };
}

/** Largo del motivo con que el admin rechaza datos de cobro (DR63 (j) 5). El dueño lo ve en su pantalla. */
export const REJECTION_REASON_MIN = 10;
export const REJECTION_REASON_MAX = 300;
