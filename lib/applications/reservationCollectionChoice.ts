import { isPaymentMethodKey, paymentMethodLabel, type Checked, type PaymentMethodKey } from "@/lib/payments/paymentMethods";
import { RESERVATION_MODE_LABELS, effectiveReservationModes, isReservationPaymentMode, type ReservationPaymentMode } from "@/lib/residences/reservationCollection";
import { offeredReservationCollection, type ApprovedCollectionMethod, type OfferedPaymentMethod } from "@/lib/residences/offeredPaymentMethods";
import { usdToArs } from "@/lib/mock/exchange";

/**
 * Cómo cobra la residencia la reserva de UNA solicitud (DR63 (d), `docs/00`; `docs/07` §16.5). Lógica PURA, sin `server-only`: la usan
 * el servidor (elección y congelado), la pantalla de la residencia (formulario y resumen) y los tests.
 *
 * Nunca recibe ni devuelve datos de cobro salvo `buildInstructionsSnapshot`, que arma el texto que se congela en el servidor.
 */

export type CollectionPath = ReservationPaymentMode;

/** Lo que la residencia puede elegir para una solicitud: sus opciones activas y los medios aceptados CON datos aprobados. */
export interface CollectionChoiceContext {
  /** Opciones efectivas (sin configurar = contacto directo, DR63 (k)). */
  modes: ReservationPaymentMode[];
  /** Medios aceptados con datos aprobados, en el orden del catálogo. Vacío si `enabled_methods` no está activa. */
  methods: OfferedPaymentMethod[];
  /** Preferencia del estudiante (DR63 (c)), solo si hoy se ofrece. */
  preferredMethod: PaymentMethodKey | null;
}

/**
 * Misma regla que vio el estudiante al solicitar (`offeredReservationCollection`): un medio cuenta solo si la residencia lo acepta Y
 * sus datos están aprobados. Los datos pendientes no se ofrecen.
 */
export function buildCollectionChoiceContext(input: {
  modes: readonly string[] | null | undefined;
  acceptedMethods: readonly string[] | null | undefined;
  approved: readonly ApprovedCollectionMethod[];
  preferred?: string | null;
}): CollectionChoiceContext {
  const offer = offeredReservationCollection({ modes: input.modes, acceptedMethods: input.acceptedMethods, approved: input.approved });
  const methods = offer.kind === "methods" ? offer.methods : [];
  const preferred = typeof input.preferred === "string" && isPaymentMethodKey(input.preferred) ? input.preferred : null;
  return {
    modes: effectiveReservationModes(input.modes),
    methods,
    preferredMethod: preferred && methods.some((m) => m.key === preferred) ? preferred : null,
  };
}

/**
 * Caminos elegibles para la solicitud. «Medios» exige la opción activa Y al menos un medio con datos aprobados. «Contacto directo» exige
 * la opción activa. Si no queda ninguno (solo «medios» y ninguno aprobado), se degrada a contacto directo: es lo que el estudiante vio
 * (`degraded` avisa a la pantalla para explicarlo).
 */
export function availableCollectionPaths(ctx: CollectionChoiceContext): { paths: CollectionPath[]; degraded: boolean } {
  const paths: CollectionPath[] = [];
  if (ctx.modes.includes("enabled_methods") && ctx.methods.length > 0) paths.push("enabled_methods");
  if (ctx.modes.includes("whatsapp_direct")) paths.push("whatsapp_direct");
  if (paths.length === 0) return { paths: ["whatsapp_direct"], degraded: true };
  return { paths, degraded: false };
}

export type ResolvedCollection =
  | { mode: "whatsapp_direct" }
  | { mode: "enabled_methods"; methodKey: PaymentMethodKey; methodLabel: string };

/**
 * Resuelve el camino y el medio. Con un solo camino disponible el servidor ignora el `collectionMode` que llegue (`docs/07` §16.5).
 * En «medios» el medio sale de lo enviado; sin envío, de la preferencia del estudiante o del único medio disponible; si no, error.
 * Un medio que no está entre los aprobados y aceptados nunca pasa, aunque el cliente lo envíe.
 */
export function resolveCollectionChoice(
  ctx: CollectionChoiceContext,
  input: { collectionMode?: unknown; chosenMethod?: unknown },
): Checked<ResolvedCollection> {
  const { paths } = availableCollectionPaths(ctx);
  let mode: CollectionPath;
  if (paths.length === 1) {
    mode = paths[0];
  } else {
    const raw = input.collectionMode;
    if (raw === undefined || raw === null || raw === "") {
      return { ok: false, error: "Elegí cómo cobrar la reserva: con medios habilitados o con contacto directo por WhatsApp." };
    }
    if (!isReservationPaymentMode(raw)) return { ok: false, error: "La opción de cobro no es válida. Recargá la página e intentá de nuevo." };
    if (!paths.includes(raw)) return { ok: false, error: "Esa opción de cobro no está disponible para esta solicitud." };
    mode = raw;
  }
  if (mode === "whatsapp_direct") return { ok: true, value: { mode } };

  const rawMethod = input.chosenMethod;
  let key: string | null = null;
  if (rawMethod !== undefined && rawMethod !== null && rawMethod !== "") {
    if (typeof rawMethod !== "string") return { ok: false, error: "El medio de pago no es válido. Recargá la página e intentá de nuevo." };
    key = rawMethod.trim();
  } else if (ctx.preferredMethod) {
    key = ctx.preferredMethod;
  } else if (ctx.methods.length === 1) {
    key = ctx.methods[0].key;
  }
  if (key === null) return { ok: false, error: "Elegí el medio con el que cobrás esta reserva." };
  const method = ctx.methods.find((m) => m.key === key);
  if (!method) return { ok: false, error: "Ese medio no figura entre los que aceptás o todavía no tiene datos de cobro aprobados. Elegí otro." };
  return { ok: true, value: { mode, methodKey: method.key, methodLabel: method.label } };
}

/** Texto que se congela en `instructions_snapshot`: nombre del medio y datos de cobro APROBADOS (nunca los pendientes). Máx. 2000. */
export const INSTRUCTIONS_SNAPSHOT_MAX = 2000;

export function buildInstructionsSnapshot(methodKey: string, approved: { methodLabel: string | null; details: string | null }): Checked<string> {
  const details = (approved.details ?? "").replace(/\r\n/g, "\n").trim();
  if (details.length === 0) return { ok: false, error: "Ese medio no tiene datos de cobro aprobados." };
  const text = `${paymentMethodLabel(methodKey, approved.methodLabel)}\n${details}`;
  if (text.length > INSTRUCTIONS_SNAPSHOT_MAX) return { ok: false, error: "Los datos de cobro de ese medio son demasiado largos." };
  return { ok: true, value: text };
}

/**
 * Monto de la reserva a fijar. Sale SIEMPRE del snapshot de la solicitud (docs/04 §6.3: la residencia no cambia el monto fuera de la
 * propuesta de ajuste). USD: pago inicial del snapshot o, si falta, la tarifa mensual. ARS: el del snapshot o, si falta, USD por el
 * tipo de cambio congelado del snapshot (docs/06 §11.2); nunca la cotización de hoy. Debe ser mayor a 0.
 */
export function resolveExpectedAmounts(snapshot: {
  reservation_payment_amount_usd?: unknown;
  reservation_payment_amount_ars?: unknown;
  monthly_price_usd?: unknown;
  exchange_rate_ars_per_usd?: unknown;
}): Checked<{ usd: number; ars: number }> {
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const usdRaw = num(snapshot.reservation_payment_amount_usd) ?? num(snapshot.monthly_price_usd);
  if (usdRaw === null || usdRaw <= 0) return { ok: false, error: "No pudimos determinar el monto de la reserva de esta solicitud. Escribile a Soporte." };
  const usd = Math.round(usdRaw * 100) / 100;
  const arsSnapshot = num(snapshot.reservation_payment_amount_ars);
  const rate = num(snapshot.exchange_rate_ars_per_usd);
  const ars = arsSnapshot !== null && arsSnapshot > 0 ? arsSnapshot : rate !== null && rate > 0 ? usdToArs(usd, rate) : null;
  if (ars === null || ars <= 0) return { ok: false, error: "No pudimos determinar el monto en pesos de esta solicitud. Escribile a Soporte." };
  return { ok: true, value: { usd, ars: Math.round(ars * 100) / 100 } };
}

/** Texto de «Esto ve el estudiante» en la pantalla de la residencia, según el camino. Sin datos de cobro. */
export function studentCollectionPreview(resolved: ResolvedCollection, isMinor: boolean): string {
  if (resolved.mode === "whatsapp_direct") {
    return isMinor
      ? "El estudiante es menor: ve «La residencia le va a escribir a tu familiar vinculado por WhatsApp». Escribile solo al familiar."
      : "Ve «La residencia te va a escribir por WhatsApp». Vos le escribís con el botón de WhatsApp; el estudiante no te contacta.";
  }
  return isMinor
    ? `Su familiar vinculado ve el monto, el plazo y los datos de cobro de ${resolved.methodLabel}. El estudiante no te contacta.`
    : `Ve el monto, el plazo y los datos de cobro de ${resolved.methodLabel}. El estudiante no te contacta.`;
}

export const COLLECTION_PATH_TITLES: Record<CollectionPath, string> = RESERVATION_MODE_LABELS;

/** Aviso al estudiante o al familiar cuando se habilita el pago. Sin datos de cobro y sin prometer disponibilidad. */
export function collectionEnabledNotice(params: {
  residenceName: string;
  mode: CollectionPath;
  methodLabel: string | null;
  audience: "student" | "family";
  isMinor: boolean;
  studentName?: string;
}): { title: string; body: string } {
  const { residenceName, mode, methodLabel, audience, isMinor } = params;
  const name = params.studentName ?? "el estudiante";
  const tail = "La solicitud sigue sujeta a confirmación.";
  if (mode === "enabled_methods") {
    const label = methodLabel ?? "el medio indicado";
    if (audience === "family") {
      return {
        title: `Pago a ${residenceName} habilitado para ${name}`,
        body: `La residencia habilitó el pago de la reserva con ${label}. Vas a ver los datos de cobro en la solicitud. Se paga directamente a la residencia, dentro del plazo informado, y después se abona el fee EstuRed. ${tail}`,
      };
    }
    return {
      title: `Ya podés pagar la reserva en ${residenceName}`,
      body: isMinor
        ? `La residencia habilitó el pago con ${label}. Tu familiar vinculado ve los datos de cobro y paga dentro del plazo informado. Después se abona el fee EstuRed. ${tail}`
        : `La residencia habilitó el pago con ${label}. Vas a ver los datos de cobro en tu solicitud. Se paga directamente a la residencia, dentro del plazo informado, y después se abona el fee EstuRed. ${tail}`,
    };
  }
  if (audience === "family") {
    return {
      title: `${residenceName} te va a escribir por WhatsApp`,
      body: `La residencia habilitó el pago de la reserva de ${name} y te va a escribir por WhatsApp con el monto final y cómo pagar. ${tail}`,
    };
  }
  return {
    title: `${residenceName} habilitó el pago de tu reserva`,
    body: isMinor
      ? `La residencia le va a escribir a tu familiar vinculado por WhatsApp con el monto final y cómo pagar. ${tail}`
      : `La residencia te va a escribir por WhatsApp con el monto final y cómo pagar. ${tail}`,
  };
}
