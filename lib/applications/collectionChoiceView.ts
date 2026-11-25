import { paymentMethodLabel } from "@/lib/payments/paymentMethods";
import type { PaymentReportView } from "@/lib/applications/paymentReportView";
import { ALTERNATIVE_PREFERENCE_KEY } from "@/lib/residences/offeredPaymentMethods";
import { availableCollectionPaths, resolveExpectedAmounts, type CollectionChoiceContext, type CollectionPath } from "@/lib/applications/reservationCollectionChoice";

/**
 * Lo que la pantalla de la residencia necesita para el cobro de la reserva de UNA solicitud (DR63 (d)). Lógica PURA y serializable al
 * cliente: nunca lleva datos de cobro (`details` ni `instructions_snapshot`), solo claves, nombres de medio y montos.
 */
export type CollectionChoiceView = {
  /** `choose`: falta definir el camino (se muestra el formulario). `chosen`: ya está definido (se muestra el resumen). */
  phase: "choose" | "chosen";
  /** El estudiante es menor: la residencia contacta siempre al familiar vinculado (DR63 (m)). */
  isMinor: boolean;
  /** Solo el dueño habilita el camino de medios: el staff no ve ni congela datos de cobro. */
  isOwner: boolean;
  paths: CollectionPath[];
  /** Solo «medios» activa pero ninguno aprobado: se degradó a contacto directo. */
  degraded: boolean;
  methods: { key: string; label: string }[];
  preferredKey: string | null;
  /** DR66 (b): el estudiante eligió «Otro» (ningún medio ofrecido le sirve): la residencia lo contacta para definir otra forma de pago. */
  preferredAlternative: boolean;
  /** Monto de la reserva según las condiciones acordadas (snapshot). Solo lectura. */
  amountUsd: number | null;
  amountArs: number | null;
  chosen: { mode: CollectionPath; methodLabel: string | null; amountUsd: number | null; amountArs: number | null } | null;
  /** Mostrar el botón de WhatsApp para escribirle al estudiante (o al familiar si es menor). */
  whatsappAllowed: boolean;
  /** DR63 (e) y (l): lo que el estudiante avisó del pago («Ya pagué», «No pude realizar el pago»). `null` si no avisó nada. */
  report: PaymentReportView | null;
};

export function buildCollectionView(input: {
  status: string;
  ctx: CollectionChoiceContext;
  isMinor: boolean;
  isOwner: boolean;
  /** `application_requests.collection_mode`. */
  collectionMode: string | null;
  /** `application_requests.preferred_payment_method`. */
  preferred: string | null;
  snapshot: Record<string, unknown> | null;
  /** Fila de `external_residence_payments` (sin instrucciones). */
  payment: { chosenMethod: string | null; expectedUsd: number | null; expectedArs: number | null } | null;
  /** Aviso del estudiante sobre el pago (sin datos de cobro). */
  report?: PaymentReportView | null;
}): CollectionChoiceView | null {
  if (input.status !== "contact_established" && input.status !== "residence_payment_pending") return null;
  const ctx: CollectionChoiceContext = {
    ...input.ctx,
    preferredMethod: input.preferred && input.ctx.methods.some((m) => m.key === input.preferred) ? (input.preferred as CollectionChoiceContext["preferredMethod"]) : null,
  };
  const { paths, degraded } = availableCollectionPaths(ctx);
  const amounts = input.snapshot ? resolveExpectedAmounts(input.snapshot) : null;
  const base = {
    isMinor: input.isMinor,
    isOwner: input.isOwner,
    paths,
    degraded,
    methods: ctx.methods.map((m) => ({ key: m.key, label: m.label })),
    preferredKey: ctx.preferredMethod,
    preferredAlternative: input.preferred === ALTERNATIVE_PREFERENCE_KEY,
    amountUsd: amounts?.ok ? amounts.value.usd : null,
    amountArs: amounts?.ok ? amounts.value.ars : null,
    report: input.status === "residence_payment_pending" ? (input.report ?? null) : null,
  };

  if (input.status === "contact_established") {
    return { ...base, phase: "choose", chosen: null, whatsappAllowed: paths.includes("whatsapp_direct") };
  }

  // residence_payment_pending
  if (input.collectionMode === "enabled_methods") {
    const key = input.payment?.chosenMethod ?? null;
    const label = key ? (ctx.methods.find((m) => m.key === key)?.label ?? paymentMethodLabel(key)) : null;
    return {
      ...base,
      phase: "chosen",
      chosen: { mode: "enabled_methods", methodLabel: label, amountUsd: input.payment?.expectedUsd ?? null, amountArs: input.payment?.expectedArs ?? null },
      whatsappAllowed: false,
    };
  }
  if (input.collectionMode === "whatsapp_direct") {
    return { ...base, phase: "chosen", chosen: { mode: "whatsapp_direct", methodLabel: null, amountUsd: null, amountArs: null }, whatsappAllowed: true };
  }
  // Sin camino definido: solicitud anterior a DR63 (contacto directo) o pase automático tras una propuesta de ajuste (DR63 (k)).
  if (paths.length === 1 && paths[0] === "whatsapp_direct") {
    return { ...base, phase: "chosen", chosen: { mode: "whatsapp_direct", methodLabel: null, amountUsd: null, amountArs: null }, whatsappAllowed: true };
  }
  return { ...base, phase: "choose", chosen: null, whatsappAllowed: false };
}
