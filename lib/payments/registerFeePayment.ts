import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROOF_UPLOAD_LIMIT_MESSAGE, proofUploadAllowed } from "@/lib/security/uploadLimits";
import { createAuditLog } from "@/lib/audit";
import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";
import { normalizeBillingTaxId } from "@/lib/family/familyProfile";
import { extensionForMime, resolveDocumentType, toTypedBlob } from "@/lib/files/sniffFile";
import { safeFilename } from "@/lib/files/safeFilename";
import { resolveFeePayer } from "@/lib/payments/feePayerAccess";
import { feeStageBlocker } from "@/lib/payments/feePayerActions";
import { isFeeIssueOpen, splitFeeSnapshot } from "@/lib/payments/feeCollection";
import { loadOfferedFeeMethods } from "@/lib/payments/feeCollectionMethods";
import { paymentMethodLabel } from "@/lib/payments/paymentMethods";
import { consentVersion } from "@/lib/legal/consentVersion";

/**
 * «Ya pagué» del fee de EstuRed (DR64 (c); `docs/07` §17.3). El pagador designado (estudiante o familiar con vínculo activo y
 * `can_pay_estured_fee`) registra el pago con comprobante OBLIGATORIO (DR8 (1) no se relaja). Queda pendiente de validación del admin:
 * esto NUNCA confirma la reserva ni marca `paid`.
 *
 * Exige un medio ya elegido (`chosen_method`, `chooseFeePaymentMethodCore`) y sin aviso «No pude realizar el pago» abierto. Pasa el
 * fee de `pending_payment_method` a `pending_manual_payment`, setea `student_reported_paid_at` y limpia las marcas del job. Desde ahí el
 * fee no vence (DR64 (d)). `payment_channel` es el nombre del medio elegido, no un texto libre.
 */

export type RegisterFeePaymentResult = { ok: true } | { ok: false; error: string };

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const IVA_CONDITIONS = new Set(["consumidor_final", "responsable_inscripto", "monotributista", "exento"]);

export const CHOOSE_METHOD_FIRST = "Elegí con qué medio vas a pagar antes de informar el pago.";
export const METHOD_NO_LONGER_ENABLED = "El medio que elegiste ya no está habilitado. Elegí otro medio y volvé a informar el pago.";
const ISSUE_OPEN = "Avisaste que no pudiste pagar. Esperá la respuesta de EstuRed antes de informar un pago.";

/** Reglas de estado de «Ya pagué», antes de tocar archivos. `null` = se puede registrar. Pura. */
export function feeRegistrationBlocker(
  fee: { status: string; expires_at: string | null; chosen_method: string | null; student_payment_issue_at: string | null; student_payment_issue_resolved_at: string | null },
  now: Date,
): string | null {
  if (fee.status === "pending_manual_payment") return "Ya hay un comprobante registrado para este pago.";
  const stage = feeStageBlocker(fee, now);
  if (stage) return stage;
  if (isFeeIssueOpen(fee)) return ISSUE_OPEN;
  if (!fee.chosen_method) return CHOOSE_METHOD_FIRST;
  return null;
}

export async function registerManualFeePaymentCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; formData: FormData; now?: Date; ipAddress?: string | null; userAgent?: string | null },
): Promise<RegisterFeePaymentResult> {
  const now = params.now ?? new Date();
  const ctx = await resolveFeePayer(admin, params.actorUserId, params.applicationId);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { fee } = ctx;

  const blocker = feeRegistrationBlocker(fee, now);
  if (blocker) return { ok: false, error: blocker };
  const chosenMethod = fee.chosen_method as string;

  // El medio elegido puede haberse deshabilitado después de elegirlo: no se informa un pago a un medio que EstuRed ya no ofrece.
  // Va ANTES de subir nada, para no dejar un archivo huérfano. Si no se pueden leer los medios, no se adivina.
  const offered = await loadOfferedFeeMethods(admin);
  if (!offered.ok) return { ok: false, error: "No pudimos verificar el pago. Probá de nuevo en unos minutos." };
  if (!offered.methods.some((m) => m.key === chosenMethod)) return { ok: false, error: METHOD_NO_LONGER_ENABLED };

  // La etiqueta del medio sale del texto congelado al elegirlo (en «Otro» es el nombre que cargó el admin).
  const { data: snapshotRow, error: snapshotError } = await admin.from("estured_fee_payments").select("instructions_snapshot").eq("id", fee.id).maybeSingle();
  if (snapshotError) {
    console.error("[fee-register] snapshot read failed:", snapshotError.code, snapshotError.message);
    return { ok: false, error: "No pudimos verificar el pago. Probá de nuevo en unos minutos." };
  }
  const methodLabel = splitFeeSnapshot((snapshotRow?.instructions_snapshot as string | null) ?? null).label ?? paymentMethodLabel(chosenMethod);

  // C4 (auditoría de costos 2026-11-21): tope de cargas por hora.
  if (!(await proofUploadAllowed(admin, params.actorUserId))) return { ok: false, error: PROOF_UPLOAD_LIMIT_MESSAGE };

  const file = params.formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Adjuntá el comprobante del pago." };
  if (file.size > MAX_PROOF_BYTES) return { ok: false, error: "El archivo no puede superar los 10MB." };
  if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };
  const realType = await resolveDocumentType(file);
  if (!realType) return { ok: false, error: "El comprobante debe ser PDF, JPG, PNG o WebP." };

  const billingName = String(params.formData.get("payer_billing_name") ?? "").trim().replace(/\s+/g, " ");
  if (!billingName) return { ok: false, error: "Ingresá el nombre para la Factura C." };
  if (billingName.length > 120) return { ok: false, error: "El nombre para la factura es demasiado largo (máximo 120 caracteres)." };
  const billingCuitRaw = String(params.formData.get("payer_billing_cuit") ?? "").trim();
  let billingCuit: string | null = null;
  if (billingCuitRaw) {
    billingCuit = normalizeBillingTaxId(billingCuitRaw);
    if (!billingCuit) return { ok: false, error: "Revisá el CUIT/DNI: el CUIT lleva 11 dígitos válidos y el DNI 7 u 8." };
  }
  const ivaCondition = String(params.formData.get("payer_iva_condition") ?? "consumidor_final");
  if (!IVA_CONDITIONS.has(ivaCondition)) return { ok: false, error: "Condición de IVA inválida." };
  if (params.formData.get("acknowledge_no_refund") !== "on") {
    return { ok: false, error: "Tenés que confirmar que leíste la política del fee." };
  }

  const ext = extensionForMime(realType);
  const path = `${params.applicationId}/fee-proof-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from("payment-proofs").upload(path, await toTypedBlob(file, realType), { contentType: realType });
  if (uploadError) {
    console.error("[fee-register] upload failed:", uploadError);
    return { ok: false, error: "No pudimos subir el archivo. Intentá de nuevo." };
  }

  const { data: fileRow, error: fileError } = await admin
    .from("files")
    .insert({
      owner_user_id: params.actorUserId,
      related_entity_type: "estured_fee_payments",
      related_entity_id: fee.id,
      bucket: "payment-proofs",
      storage_path: path,
      filename: safeFilename(file.name),
      mime_type: realType,
      size_bytes: file.size,
      visibility: "context_shared",
      document_type: "other",
      status: "uploaded",
      uploaded_by_user_id: params.actorUserId,
    })
    .select("id")
    .single();
  if (fileError || !fileRow) {
    console.error("[fee-register] file row failed:", fileError);
    await admin.storage.from("payment-proofs").remove([path]);
    return { ok: false, error: "No pudimos registrar el comprobante." };
  }

  // Compare-and-set: solo si el fee sigue esperando el pago con el MISMO medio, no venció, el pagador sigue siendo quien lo registra y
  // no entró un aviso «No pude realizar el pago» mientras tanto. Un familiar des-designado o un comprobante ya cargado no se pisan.
  const base = admin
    .from("estured_fee_payments")
    .update({
      status: "pending_manual_payment",
      payment_provider: "manual",
      manual_payment_file_id: fileRow.id,
      payment_channel: methodLabel.slice(0, 80),
      payer_billing_name: billingName,
      payer_billing_cuit: billingCuit,
      payer_iva_condition: ivaCondition,
      student_reported_paid_at: now.toISOString(),
      payer_reminder_sent_at: null,
      admin_reminder_sent_at: null,
      admin_alert_sent_at: null,
    })
    .eq("id", fee.id)
    .eq("status", "pending_payment_method")
    .eq("payer_user_id", params.actorUserId)
    .eq("chosen_method", chosenMethod)
    .gt("expires_at", now.toISOString());
  const { data: updatedRows, error: updateError } = await (fee.student_payment_issue_at
    ? base.eq("student_payment_issue_at", fee.student_payment_issue_at)
    : base.is("student_payment_issue_at", null)
  ).select("id");
  if (updateError || !updatedRows || updatedRows.length === 0) {
    if (updateError) console.error("[fee-register] update failed:", updateError);
    // El comprobante subido no quedó asociado a ningún pago: se limpia (mejor esfuerzo).
    await admin.from("files").delete().eq("id", fileRow.id);
    await admin.storage.from("payment-proofs").remove([path]);
    return {
      ok: false,
      error: updateError
        ? "No pudimos registrar el pago."
        : "El pago ya no se puede registrar: cambió el pagador o el medio, el plazo venció o hay un aviso abierto. Actualizá la página.",
    };
  }

  // LEG-012: la casilla del fee queda como consentimiento con versión y hash del texto. Si no se puede guardar, el pago ya quedó
  // registrado: se loguea y se avisa al admin (la casilla se validó arriba).
  const { error: consentError } = await admin.from("consents").insert({
    user_id: params.actorUserId,
    consent_type: "estured_fee_terms",
    version: consentVersion("estured_fee_terms"),
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    related_entity_type: "estured_fee_payments",
    related_entity_id: fee.id,
    metadata: { reported_by: ctx.role },
  });
  if (consentError) console.error("[fee-register] consent insert failed:", consentError.code);

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: ctx.role === "student" ? "student" : "family_member",
    action: "estured_fee_manual_payment_registered",
    entityType: "estured_fee_payments",
    entityId: fee.id,
    newValue: { method_key: chosenMethod, with_proof: true, reported_by: ctx.role },
    source: "user",
  });
  await notifyAdminsSafe(admin, {
    title: "Hay un pago del fee para validar",
    body: "Un pagador informó el pago del fee EstuRed y subió el comprobante. Revisalo en Pagos.",
    entityType: "estured_fee_payments",
    entityId: fee.id,
  });
  return { ok: true };
}
