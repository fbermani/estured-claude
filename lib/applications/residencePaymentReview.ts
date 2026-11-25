import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidencePermission } from "@/lib/residences/access";
import { planCollection } from "@/lib/applications/enableResidencePayment";
import { notifyCollectionEnabled } from "@/lib/applications/notifyCollectionEnabled";
import { notifyStudentAndFamily } from "@/lib/applications/paymentReportNotices";
import { openResidencePaymentSupportCase } from "@/lib/applications/residencePaymentSupportCase";
import { isPaymentIssueOpen, validateDisputeReason } from "@/lib/applications/paymentReportView";
import { PROOF_BUCKET, PROOF_DOCUMENT_TYPE } from "@/lib/applications/studentPaymentProof";
import { normalizeReopenCount, reopenCapReached, RESIDENCE_REOPEN_CAP_MESSAGE } from "@/lib/payments/reopenCap";

/**
 * La residencia responde al aviso del estudiante sobre el pago de la reserva (DR63 (e), (j), (l); docs/07 §16.7, §16.9 y §16.10).
 * Capa de negocio con `(admin, params)`: la usan las server actions de `app/residence/[residence_id]/applications/[id]/payment/`.
 * El permiso (`payments.residence`) y el rol del actor salen de la BASE, nunca del formulario. Nada cambia la máquina de estados de
 * `application_requests` (la solicitud sigue en `residence_payment_pending`; pasa a `disputed` solo por Sistema o Admin, docs/04 §5.4).
 * Ni la auditoría ni los avisos llevan datos de cobro completos (solo enmascarados).
 */

export type ReviewResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "No encontramos esa solicitud.";
const NOT_PENDING = "Esa solicitud no está esperando el pago de la reserva.";
const STALE = "El pago ya cambió de estado. Actualizá la página.";
const SAVE_FAILED = "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.";
const PAYMENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const CLEAR_MARKS = { residence_reminder_sent_at: null, student_reminder_sent_at: null, admin_alert_sent_at: null, admin_escalated_at: null } as const;

type AppRow = {
  id: string;
  status: string;
  residence_id: string;
  student_profile_id: string;
  contact_target: string | null;
  collection_mode: string | null;
  snapshot_final_id: string | null;
  snapshot_original_id: string | null;
  payment_deadline_at: string | null;
};

async function loadApp(admin: SupabaseClient, applicationId: string): Promise<AppRow | null> {
  const { data, error } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, contact_target, collection_mode, snapshot_final_id, snapshot_original_id, payment_deadline_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) console.error("[payment-review] application read failed:", error.code, error.message);
  return (data as AppRow | null) ?? null;
}

/** «No recibí el pago»: el pago pasa a `disputed`, se abre un caso de Soporte y se avisa al estudiante (docs/07 §16.7). */
export async function disputeReportedResidencePaymentCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; reason: unknown; termsAccepted: boolean },
): Promise<ReviewResult> {
  const app = await loadApp(admin, params.applicationId);
  if (!app) return { ok: false, error: NOT_FOUND };
  const access = await assertResidencePermission(admin, params.actorUserId, app.residence_id, "payments.residence");
  if (!access.ok) return { ok: false, error: access.error };
  if (app.status !== "residence_payment_pending") return { ok: false, error: NOT_PENDING };

  const reason = validateDisputeReason(params.reason);
  if (!reason.ok) return { ok: false, error: reason.error };
  if (!params.termsAccepted) return { ok: false, error: "Confirmá que leíste el alcance de Soporte antes de continuar." };

  const { data: payment, error: paymentError } = await admin
    .from("external_residence_payments")
    .select("id, status")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (paymentError) {
    console.error("[payment-review] payment read failed:", paymentError.code, paymentError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!payment || payment.status !== "student_reported_paid") {
    return { ok: false, error: "Solo podés registrar que no recibiste un pago que el estudiante avisó como hecho." };
  }

  const { data: claimed, error: claimError } = await admin
    .from("external_residence_payments")
    .update({ status: "disputed", dispute_reason: reason.value })
    .eq("id", payment.id)
    .eq("status", "student_reported_paid")
    .select("id");
  if (claimError) {
    console.error("[payment-review] dispute claim failed:", claimError.code, claimError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: STALE };

  const supportCase = await openResidencePaymentSupportCase(admin, {
    applicationId: params.applicationId,
    residenceId: app.residence_id,
    openedByUserId: params.actorUserId,
    openedByRole: access.actorRole,
    description:
      "La residencia informó que no recibió un pago que el estudiante avisó haber hecho. " +
      `Motivo indicado por la residencia: ${reason.value}`,
    termsAcceptedAt: new Date().toISOString(),
    auditSource: "user",
  });
  if (!supportCase.ok && !supportCase.schemaMissing) {
    // Sin el caso el admin no se entera: se deshace la disputa y se pide reintentar.
    await admin
      .from("external_residence_payments")
      .update({ status: "student_reported_paid", dispute_reason: null })
      .eq("id", payment.id)
      .eq("status", "disputed");
    return { ok: false, error: "No pudimos abrir el caso de Soporte. Intentá de nuevo en unos minutos." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_payment_disputed",
    entityType: "application_requests",
    entityId: params.applicationId,
    newValue: { payment_status: "disputed", support_case_id: supportCase.ok ? supportCase.supportCaseId : null },
    reasonText: reason.value,
    source: "user",
  });

  const isMinor = app.contact_target === "family_member";
  await notifyStudentAndFamily(admin, {
    applicationId: params.applicationId,
    studentProfileId: app.student_profile_id,
    student: {
      title: "La residencia no encontró tu pago",
      body: "Soporte de EstuRed revisa el caso. Tené a mano tu comprobante. La solicitud sigue sujeta a confirmación.",
    },
    family: isMinor
      ? {
          title: "La residencia no encontró el pago de la reserva",
          body: "Soporte de EstuRed revisa el caso. Tené a mano el comprobante. La solicitud sigue sujeta a confirmación.",
        }
      : null,
  });
  return { ok: true };
}

export type PaymentIssueResolution = "contact_whatsapp" | "reenable_payment";

/**
 * Responde «No pude realizar el pago» (docs/07 §16.10): contactar por WhatsApp (la solicitud pasa a `whatsapp_direct`) o volver a
 * habilitar el pago (re-congela los datos de cobro APROBADOS; solo el dueño, igual que al habilitarlo). En ambos casos cierra el aviso,
 * reinicia el plazo de 48 h y limpia las marcas del job (si no, el recordatorio de 12 h nunca saldría para el plazo nuevo).
 * El monto no se cambia: sale del snapshot (docs/04 §6.3).
 */
export async function resolveStudentPaymentIssueCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; resolution: unknown; chosenMethod?: unknown },
): Promise<ReviewResult> {
  if (params.resolution !== "contact_whatsapp" && params.resolution !== "reenable_payment") {
    return { ok: false, error: "La opción no es válida. Recargá la página e intentá de nuevo." };
  }
  const resolution: PaymentIssueResolution = params.resolution;

  const app = await loadApp(admin, params.applicationId);
  if (!app) return { ok: false, error: NOT_FOUND };
  const access = await assertResidencePermission(admin, params.actorUserId, app.residence_id, "payments.residence");
  if (!access.ok) return { ok: false, error: access.error };
  if (app.status !== "residence_payment_pending" || app.collection_mode !== "enabled_methods") return { ok: false, error: NOT_PENDING };

  const { data: payment, error: paymentError } = await admin
    .from("external_residence_payments")
    .select("id, status, chosen_method, student_payment_issue_at, student_payment_issue_resolved_at, reopen_count")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (paymentError) {
    console.error("[payment-review] payment read failed:", paymentError.code, paymentError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!payment || payment.status !== "pending" || !isPaymentIssueOpen(payment)) {
    return { ok: false, error: "El estudiante no tiene un aviso de pago abierto." };
  }
  // DR66 (a): máximo 2 reaperturas por pago. Solo «Volver a habilitar el pago» cuenta; «Contactar por WhatsApp» no reabre nada.
  const reopenCount = normalizeReopenCount(payment.reopen_count);
  if (resolution === "reenable_payment" && reopenCapReached(reopenCount)) return { ok: false, error: RESIDENCE_REOPEN_CAP_MESSAGE };

  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString();
  let paymentUpdate: Record<string, unknown>;
  let methodLabel: string | null = null;
  let maskedDetails: string | null = null;

  if (resolution === "reenable_payment") {
    // Congelar de nuevo exige ser el dueño (el staff no ve ni congela datos de cobro) y usa SOLO los datos aprobados.
    const planned = await planCollection(admin, {
      applicationId: params.applicationId,
      residenceId: app.residence_id,
      snapshotId: app.snapshot_final_id ?? app.snapshot_original_id,
      actorUserId: params.actorUserId,
      input: { collectionMode: "enabled_methods", chosenMethod: params.chosenMethod ?? payment.chosen_method ?? undefined },
    });
    if (!planned.ok) return { ok: false, error: planned.error };
    const plan = planned.plan;
    if (plan.legacy || plan.resolved.mode !== "enabled_methods" || !plan.payment) {
      return { ok: false, error: "Ya no tenés medios habilitados con datos aprobados. Contactá al estudiante por WhatsApp." };
    }
    methodLabel = plan.resolved.methodLabel;
    maskedDetails = plan.maskedDetails;
    paymentUpdate = { ...plan.payment, student_payment_issue_resolved_at: now, reopen_count: reopenCount + 1, ...CLEAR_MARKS };
  } else {
    // Contacto por WhatsApp: el estudiante deja de ver datos de cobro, así que el texto congelado ya no se conserva.
    paymentUpdate = { instructions_snapshot: null, student_payment_issue_resolved_at: now, ...CLEAR_MARKS };
  }

  // Compare-and-set sobre la solicitud: dos respuestas simultáneas no se pisan.
  const { data: appClaimed, error: appError } = await admin
    .from("application_requests")
    .update({
      payment_deadline_at: deadline,
      ...(resolution === "contact_whatsapp" ? { collection_mode: "whatsapp_direct" } : {}),
    })
    .eq("id", params.applicationId)
    .eq("status", "residence_payment_pending")
    .eq("collection_mode", "enabled_methods")
    .select("id");
  if (appError) {
    console.error("[payment-review] application update failed:", appError.code, appError.message);
    return { ok: false, error: SAVE_FAILED };
  }
  if (!appClaimed || appClaimed.length === 0) return { ok: false, error: STALE };

  const { data: paymentClaimed, error: paymentUpdateError } = await admin
    .from("external_residence_payments")
    .update(paymentUpdate)
    .eq("id", payment.id)
    .eq("status", "pending")
    .eq("reopen_count", reopenCount)
    .is("student_payment_issue_resolved_at", null)
    .select("id");
  if (paymentUpdateError || !paymentClaimed || paymentClaimed.length === 0) {
    await admin
      .from("application_requests")
      .update({ payment_deadline_at: app.payment_deadline_at, collection_mode: "enabled_methods" })
      .eq("id", params.applicationId)
      .eq("status", "residence_payment_pending");
    if (paymentUpdateError) console.error("[payment-review] payment update failed:", paymentUpdateError.code, paymentUpdateError.message);
    return { ok: false, error: paymentUpdateError ? SAVE_FAILED : STALE };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_payment_issue_resolved",
    entityType: "application_requests",
    entityId: params.applicationId,
    newValue: {
      resolution,
      collection_mode: resolution === "contact_whatsapp" ? "whatsapp_direct" : "enabled_methods",
      ...(resolution === "reenable_payment" ? { instructions_masked: maskedDetails, reopen_count: reopenCount + 1 } : {}),
    },
    source: "user",
  });
  await notifyCollectionEnabled(admin, {
    applicationId: params.applicationId,
    residenceId: app.residence_id,
    studentProfileId: app.student_profile_id,
    mode: resolution === "contact_whatsapp" ? "whatsapp_direct" : "enabled_methods",
    methodLabel,
    isMinor: app.contact_target === "family_member",
  });
  return { ok: true };
}

export type ProofLinkResult = { ok: true; url: string } | { ok: false; error: string };

const PROOF_LINK_SECONDS = 300;

/**
 * Link firmado corto al comprobante que el estudiante adjuntó a «Ya pagué». Solo el dueño y el staff con `payments.residence` de ESA
 * residencia. El archivo sale del pago de la solicitud (nunca de un id que mande el cliente) y se registra la apertura ANTES de firmar.
 * Falla cerrado, con un único mensaje para «no hay comprobante» y «no tenés acceso al archivo».
 */
export async function openStudentPaymentProofCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string },
): Promise<ProofLinkResult> {
  const unavailable = "No encontramos un comprobante para esta solicitud.";
  const app = await loadApp(admin, params.applicationId);
  if (!app) return { ok: false, error: unavailable };
  const access = await assertResidencePermission(admin, params.actorUserId, app.residence_id, "payments.residence");
  if (!access.ok) return { ok: false, error: access.error };

  const { data: payment, error: paymentError } = await admin
    .from("external_residence_payments")
    .select("student_proof_file_id")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (paymentError) console.error("[payment-review] proof payment read failed:", paymentError.code, paymentError.message);
  const fileId = (payment?.student_proof_file_id as string | null | undefined) ?? null;
  if (!fileId) return { ok: false, error: unavailable };

  const { data: file } = await admin
    .from("files")
    .select("id, bucket, storage_path, document_type, related_entity_type, related_entity_id")
    .eq("id", fileId)
    .maybeSingle();
  if (
    !file ||
    file.bucket !== PROOF_BUCKET ||
    file.document_type !== PROOF_DOCUMENT_TYPE ||
    file.related_entity_type !== "application_requests" ||
    file.related_entity_id !== params.applicationId
  ) {
    return { ok: false, error: unavailable };
  }

  const logged = await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: "residence_payment_proof_accessed",
    entityType: "files",
    entityId: fileId,
    newValue: { application_request_id: params.applicationId, residence_id: app.residence_id },
    source: "user",
  });
  if (!logged) return { ok: false, error: "No pudimos registrar la apertura del comprobante. Probá de nuevo." };

  const { data: signed, error: signError } = await admin.storage.from(PROOF_BUCKET).createSignedUrl(file.storage_path as string, PROOF_LINK_SECONDS);
  if (signError || !signed?.signedUrl) {
    console.error("[payment-review] no se pudo firmar el comprobante:", signError?.message ?? "sin url");
    return { ok: false, error: "No pudimos abrir el comprobante. Probá de nuevo en un rato." };
  }
  return { ok: true, url: signed.signedUrl };
}
