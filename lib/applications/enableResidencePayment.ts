import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertRegulationAccepted } from "@/lib/regulations/gate";
import { assertResidenceOwner, assertResidencePermission } from "@/lib/residences/access";
import { checkStayChangeAdvanceGate } from "@/lib/stayChange/advanceGate";
import { maskPaymentDetails } from "@/lib/payments/paymentMethods";
import { createPendingResidencePayment, type FrozenPaymentColumns } from "@/lib/applications/residencePayment";
import { loadCollectionChoice, readApplicationCollectionColumns } from "@/lib/applications/collectionChoiceDb";
import { notifyCollectionEnabled } from "@/lib/applications/notifyCollectionEnabled";
import {
  buildInstructionsSnapshot,
  resolveCollectionChoice,
  resolveExpectedAmounts,
  type ResolvedCollection,
} from "@/lib/applications/reservationCollectionChoice";

/**
 * La residencia habilita el pago de la reserva de UNA solicitud y define cómo se cobra (DR63 (d), `docs/00`; `docs/07` §16.5).
 * Dos pasos, ambos con validación en el servidor:
 *
 *  - `enableResidencePaymentCore`: `contact_established` → `residence_payment_pending`, sin propuesta de ajuste.
 *  - `chooseResidencePaymentCollectionCore`: solicitud YA en `residence_payment_pending` sin camino definido (tras una propuesta de
 *    ajuste el pase es automático, DR63 (k)); la residencia lo elige desde el detalle y el plazo de 48 h se reinicia.
 *
 * Camino A («Cobro con medios habilitados»): congela en `external_residence_payments` el medio, el monto y el texto de instrucciones
 * (armado con los datos de cobro APROBADOS). Solo el DUEÑO (el staff no ve ni congela datos de cobro). Camino B («Contacto directo por
 * WhatsApp»): sin instrucciones; lo puede hacer quien tenga `payments.residence`, como antes de DR63.
 * El monto sale siempre del snapshot: la residencia no lo cambia fuera de la propuesta de ajuste (`docs/04` §6.3).
 * La máquina de estados no cambia. Los datos de cobro nunca van a la auditoría ni a los avisos completos.
 */

export type CollectionInput = { collectionMode?: unknown; chosenMethod?: unknown };
export type EnableResidencePaymentResult = { ok: true; residenceId: string } | { ok: false; error: string };

const STALE_STATE_MESSAGE = "La solicitud ya cambió de estado, actualizá la página.";
const NOT_READY_MESSAGE = "El cobro de la reserva todavía no está disponible en este entorno.";
const READ_FAILED_MESSAGE = "No pudimos verificar cómo cobra tu residencia. Intentá de nuevo en unos minutos.";
const PAYMENT_WINDOW_MS = 48 * 60 * 60 * 1000;

const err = (error: string): { ok: false; error: string } => ({ ok: false, error });
const asInput = (v: unknown): CollectionInput => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as CollectionInput) : {});

type Plan =
  /** Sin la migración 0102: comportamiento anterior a DR63 (no se escriben columnas nuevas). */
  | { legacy: true }
  | { legacy: false; resolved: ResolvedCollection; payment: FrozenPaymentColumns | null; maskedDetails: string | null };

/**
 * Resuelve el camino y arma lo que se congela, SIN escribir nada. En el camino A exige ser el dueño, que el medio esté aceptado con datos
 * aprobados y que el monto del snapshot sea mayor a 0.
 */
async function planCollection(
  admin: SupabaseClient,
  params: { applicationId: string; residenceId: string; snapshotId: string | null; actorUserId: string; input: CollectionInput },
): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  const columns = await readApplicationCollectionColumns(admin, params.applicationId);
  if (!columns) return err(READ_FAILED_MESSAGE);
  if (!columns.schemaReady) return { ok: true, plan: { legacy: true } };

  const load = await loadCollectionChoice(admin, params.residenceId, columns.preferred);
  if (load.kind === "missing") return { ok: true, plan: { legacy: true } };
  if (load.kind === "error") return err(READ_FAILED_MESSAGE);

  const choice = resolveCollectionChoice(load.ctx, params.input);
  if (!choice.ok) return err(choice.error);
  const resolved = choice.value;
  if (resolved.mode === "whatsapp_direct") return { ok: true, plan: { legacy: false, resolved, payment: null, maskedDetails: null } };

  // Camino A: los datos de cobro son sensibles. Solo el dueño de ESTA residencia (el rol sale de la base, no del formulario).
  const owner = await assertResidenceOwner(admin, params.actorUserId, params.residenceId);
  if (!owner.ok) return err(owner.error);

  const account = load.accounts.get(resolved.methodKey);
  if (!account) return err("Ese medio no tiene datos de cobro aprobados. Elegí otro.");
  const instructions = buildInstructionsSnapshot(resolved.methodKey, account);
  if (!instructions.ok) return err(instructions.error);

  if (!params.snapshotId) return err("No pudimos determinar el monto de la reserva de esta solicitud. Escribile a Soporte.");
  const { data: snapshot, error: snapshotError } = await admin
    .from("application_snapshots")
    .select("reservation_payment_amount_usd, reservation_payment_amount_ars, monthly_price_usd, exchange_rate_ars_per_usd")
    .eq("id", params.snapshotId)
    .maybeSingle();
  if (snapshotError || !snapshot) {
    if (snapshotError) console.error("[enable-payment] snapshot read failed:", snapshotError.code, snapshotError.message);
    return err(READ_FAILED_MESSAGE);
  }
  const amounts = resolveExpectedAmounts(snapshot as Record<string, unknown>);
  if (!amounts.ok) return err(amounts.error);

  return {
    ok: true,
    plan: {
      legacy: false,
      resolved,
      payment: {
        chosen_method: resolved.methodKey,
        expected_amount_usd: amounts.value.usd,
        expected_amount_ars: amounts.value.ars,
        instructions_snapshot: instructions.value,
      },
      maskedDetails: maskPaymentDetails(account.details),
    },
  };
}

/** Lo que queda en la auditoría: camino, medio y montos. Los datos de cobro, SOLO enmascarados. */
function auditValue(plan: Extract<Plan, { legacy: false }>) {
  return {
    collection_mode: plan.resolved.mode,
    chosen_method: plan.payment?.chosen_method ?? null,
    expected_amount_usd: plan.payment?.expected_amount_usd ?? null,
    expected_amount_ars: plan.payment?.expected_amount_ars ?? null,
    instructions_masked: plan.maskedDetails,
  };
}

export async function enableResidencePaymentCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; input?: unknown },
): Promise<EnableResidencePaymentResult> {
  const { actorUserId, applicationId } = params;
  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, proposal_count, snapshot_original_id, contact_target, payment_deadline_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return err("No encontramos esa solicitud.");

  const access = await assertResidencePermission(admin, actorUserId, application.residence_id, "payments.residence");
  if (!access.ok) return err(access.error);
  // DR14: avanzar la solicitud exige que el estudiante ya haya aceptado el reglamento.
  const regulation = await assertRegulationAccepted(admin, applicationId);
  if (!regulation.ok) return err(regulation.error);

  if (application.status !== "contact_established") return err("Esa solicitud no está en un estado válido para habilitar el pago.");
  if (application.proposal_count > 0) return err("Ya enviaste una propuesta de ajuste — el estudiante tiene que responderla primero.");

  // DR3: una solicitud creada bajo el aviso "Quiero cambiar" no avanza a pago antes de 48 h (supuesto reversible).
  const gate = await checkStayChangeAdvanceGate(admin, { applicationId, audience: "residence" });
  if (!gate.ok) return err(gate.error);

  // Todo se lee y se valida ANTES de la primera escritura.
  const planned = await planCollection(admin, {
    applicationId,
    residenceId: application.residence_id,
    snapshotId: application.snapshot_original_id,
    actorUserId,
    input: asInput(params.input),
  });
  if (!planned.ok) return err(planned.error);
  const plan = planned.plan;

  const paymentDeadline = new Date(Date.now() + PAYMENT_WINDOW_MS);
  const { data: enabledRow, error } = await admin
    .from("application_requests")
    .update({
      status: "residence_payment_pending",
      snapshot_final_id: application.snapshot_original_id,
      payment_deadline_at: paymentDeadline.toISOString(),
      ...(plan.legacy ? {} : { collection_mode: plan.resolved.mode }),
    })
    .eq("id", applicationId)
    .eq("status", "contact_established")
    .select("id")
    .maybeSingle();
  if (error) return err("No pudimos guardar el cambio.");
  if (!enabledRow) return err(STALE_STATE_MESSAGE);

  const created = await createPendingResidencePayment(admin, {
    applicationId,
    residenceId: application.residence_id,
    studentProfileId: application.student_profile_id,
    collection: plan.legacy ? null : plan.payment,
  });
  if (created === false) {
    // Sin la fila de pago (y sus datos congelados) la solicitud no puede quedar en `residence_payment_pending`: se revierte el cambio.
    await admin
      .from("application_requests")
      .update({
        status: "contact_established",
        snapshot_final_id: null,
        payment_deadline_at: application.payment_deadline_at ?? null,
        ...(plan.legacy ? {} : { collection_mode: null }),
      })
      .eq("id", applicationId)
      .eq("status", "residence_payment_pending");
    return err("No pudimos habilitar el pago. Intentá de nuevo en unos minutos.");
  }

  const pathNote = plan.legacy
    ? ""
    : plan.resolved.mode === "enabled_methods"
      ? ` Cobro con ${plan.resolved.methodLabel}.`
      : " Contacto directo por WhatsApp.";
  await admin.from("application_status_events").insert({
    application_request_id: applicationId,
    from_status: "contact_established",
    to_status: "residence_payment_pending",
    changed_by_user_id: actorUserId,
    changed_by_role: access.actorRole,
    reason_text: `Sin propuesta de ajuste — condiciones originales confirmadas.${pathNote}`,
  });

  await createAuditLog(admin, {
    actorUserId,
    actorRole: access.actorRole,
    action: "residence_payment_enabled_without_negotiation",
    entityType: "application_requests",
    entityId: applicationId,
    ...(plan.legacy ? {} : { newValue: auditValue(plan) }),
  });

  await notifyCollectionEnabled(admin, {
    applicationId,
    residenceId: application.residence_id,
    studentProfileId: application.student_profile_id,
    mode: plan.legacy ? "whatsapp_direct" : plan.resolved.mode,
    methodLabel: !plan.legacy && plan.resolved.mode === "enabled_methods" ? plan.resolved.methodLabel : null,
    isMinor: application.contact_target === "family_member",
  });
  return { ok: true, residenceId: application.residence_id as string };
}

/**
 * Define cómo se cobra una solicitud que ya está en `residence_payment_pending` sin camino (DR63 (k): tras una propuesta de ajuste el
 * pase es automático). Reinicia el plazo de 48 h al elegir. Mismas reglas de autorización y congelado que `enableResidencePaymentCore`.
 */
export async function chooseResidencePaymentCollectionCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; input?: unknown },
): Promise<EnableResidencePaymentResult> {
  const { actorUserId, applicationId } = params;
  const { data: application } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, snapshot_final_id, snapshot_original_id, contact_target, payment_deadline_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return err("No encontramos esa solicitud.");

  const access = await assertResidencePermission(admin, actorUserId, application.residence_id, "payments.residence");
  if (!access.ok) return err(access.error);
  const regulation = await assertRegulationAccepted(admin, applicationId);
  if (!regulation.ok) return err(regulation.error);

  if (application.status !== "residence_payment_pending") return err("Esa solicitud no está esperando el pago de la reserva.");

  const columns = await readApplicationCollectionColumns(admin, applicationId);
  if (!columns) return err(READ_FAILED_MESSAGE);
  if (!columns.schemaReady) return err(NOT_READY_MESSAGE);
  if (columns.collectionMode) return err("Ya definiste cómo cobrar esta reserva.");

  const { data: payment, error: paymentError } = await admin
    .from("external_residence_payments")
    .select("id, status, chosen_method")
    .eq("application_request_id", applicationId)
    .maybeSingle();
  if (paymentError) {
    console.error("[enable-payment] payment read failed:", paymentError.code, paymentError.message);
    return err(READ_FAILED_MESSAGE);
  }
  if (!payment || payment.status !== "pending" || payment.chosen_method) return err("El pago de esta solicitud ya no admite cambios.");

  const planned = await planCollection(admin, {
    applicationId,
    residenceId: application.residence_id,
    snapshotId: application.snapshot_final_id ?? application.snapshot_original_id,
    actorUserId,
    input: asInput(params.input),
  });
  if (!planned.ok) return err(planned.error);
  if (planned.plan.legacy) return err(NOT_READY_MESSAGE);
  const plan = planned.plan;

  // El camino se reclama con compare-and-set: dos elecciones simultáneas no se pisan.
  const { data: claimed, error: claimError } = await admin
    .from("application_requests")
    .update({
      collection_mode: plan.resolved.mode,
      payment_deadline_at: new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "residence_payment_pending")
    .is("collection_mode", null)
    .select("id")
    .maybeSingle();
  if (claimError) return err("No pudimos guardar el cambio.");
  if (!claimed) return err(STALE_STATE_MESSAGE);

  if (plan.payment) {
    const { data: frozen, error: freezeError } = await admin
      .from("external_residence_payments")
      .update(plan.payment)
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (freezeError || !frozen) {
      await admin
        .from("application_requests")
        .update({ collection_mode: null, payment_deadline_at: application.payment_deadline_at ?? null })
        .eq("id", applicationId)
        .eq("status", "residence_payment_pending");
      return err(freezeError ? "No pudimos guardar el cambio." : STALE_STATE_MESSAGE);
    }
  }

  await createAuditLog(admin, {
    actorUserId,
    actorRole: access.actorRole,
    action: "residence_payment_collection_chosen",
    entityType: "application_requests",
    entityId: applicationId,
    newValue: auditValue(plan),
  });
  await notifyCollectionEnabled(admin, {
    applicationId,
    residenceId: application.residence_id,
    studentProfileId: application.student_profile_id,
    mode: plan.resolved.mode,
    methodLabel: plan.resolved.mode === "enabled_methods" ? plan.resolved.methodLabel : null,
    isMinor: application.contact_target === "family_member",
  });
  return { ok: true, residenceId: application.residence_id as string };
}
