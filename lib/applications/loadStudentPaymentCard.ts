import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePaymentActor, type PaymentActorRole } from "@/lib/applications/studentPaymentAccess";
import { isPaymentIssueOpen } from "@/lib/applications/paymentReportView";
import { loadCollectionChoice } from "@/lib/applications/collectionChoiceDb";
import { availableCollectionPaths } from "@/lib/applications/reservationCollectionChoice";

/**
 * Lo que ve el ESTUDIANTE (o el familiar pagador de un menor) del pago de la reserva en el detalle de su solicitud (DR63 (c), (d), (j) 3).
 *
 * `instructions` (los datos de cobro congelados, `instructions_snapshot`) se lee SOLO acá, con service role, DESPUÉS de comprobar en la
 * base que el usuario es el estudiante de la solicitud o el familiar pagador de un menor (`resolvePaymentActor`). Nunca staff ni dueño
 * de la residencia, nunca otros estudiantes, y solo con la solicitud en `residence_payment_pending`. Sin acceso devuelve `null`.
 * Serializable al cliente: los datos de cobro viajan SOLO a quien tiene derecho a verlos.
 *
 * Contacto directo (`whatsapp_direct`): solo el mensaje «La residencia te va a escribir por WhatsApp». Nunca un número ni un botón.
 */

export type StudentPaymentStage = "to_pay" | "reported" | "issue_open" | "disputed";

export type StudentPaymentCardView =
  | {
      kind: "enabled_methods";
      actorRole: PaymentActorRole;
      isMinor: boolean;
      stage: StudentPaymentStage;
      methodLabel: string | null;
      /** Datos de cobro (sin la línea del nombre del medio). `null` mientras no corresponde mostrarlos. */
      instructions: string | null;
      amountUsd: number | null;
      amountArs: number | null;
      deadlineAt: string | null;
      reportedPaidAt: string | null;
      hasProof: boolean;
      issueAt: string | null;
    }
  | { kind: "whatsapp_direct"; actorRole: PaymentActorRole; isMinor: boolean }
  /** Tras una propuesta de ajuste la residencia todavía no definió cómo cobra. */
  | { kind: "choosing"; actorRole: PaymentActorRole; isMinor: boolean };

type PaymentRow = {
  status: string;
  chosen_method: string | null;
  expected_amount_usd: number | string | null;
  expected_amount_ars: number | string | null;
  instructions_snapshot: string | null;
  student_reported_paid_at: string | null;
  student_proof_file_id: string | null;
  student_payment_issue_at: string | null;
  student_payment_issue_resolved_at: string | null;
};

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

/** Separa «Nombre del medio\n datos» (formato de `buildInstructionsSnapshot`). */
export function splitInstructionsSnapshot(snapshot: string | null): { label: string | null; details: string | null } {
  if (!snapshot) return { label: null, details: null };
  const at = snapshot.indexOf("\n");
  if (at === -1) return { label: null, details: snapshot.trim() || null };
  return { label: snapshot.slice(0, at).trim() || null, details: snapshot.slice(at + 1).trim() || null };
}

export async function loadStudentPaymentCard(admin: SupabaseClient, params: { userId: string; applicationId: string }): Promise<StudentPaymentCardView | null> {
  const actor = await resolvePaymentActor(admin, params.userId, params.applicationId);
  if (!actor.ok || actor.application.status !== "residence_payment_pending") return null;
  const { role, isMinor, application } = actor;

  const mode = application.collection_mode;
  if (mode === "whatsapp_direct") return { kind: "whatsapp_direct", actorRole: role, isMinor };
  if (mode !== "enabled_methods") {
    // Sin camino definido: solicitud anterior a DR63 (contacto directo) o pase automático tras una propuesta de ajuste (DR63 (k)).
    const load = await loadCollectionChoice(admin, application.residence_id);
    if (load.kind !== "ok") return { kind: "whatsapp_direct", actorRole: role, isMinor };
    const { paths } = availableCollectionPaths(load.ctx);
    if (paths.length === 1 && paths[0] === "whatsapp_direct") return { kind: "whatsapp_direct", actorRole: role, isMinor };
    return { kind: "choosing", actorRole: role, isMinor };
  }

  const { data, error } = await admin
    .from("external_residence_payments")
    .select(
      "status, chosen_method, expected_amount_usd, expected_amount_ars, instructions_snapshot, student_reported_paid_at, student_proof_file_id, student_payment_issue_at, student_payment_issue_resolved_at",
    )
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (error) {
    console.error("[student-payment-card] payment read failed:", error.code, error.message);
    return null;
  }
  const row = data as PaymentRow | null;
  if (!row) return null;

  const issueOpen = isPaymentIssueOpen(row);
  const stage: StudentPaymentStage =
    row.status === "disputed" ? "disputed" : row.status === "student_reported_paid" ? "reported" : issueOpen ? "issue_open" : "to_pay";
  const { label, details } = splitInstructionsSnapshot(row.instructions_snapshot);

  return {
    kind: "enabled_methods",
    actorRole: role,
    isMinor,
    stage,
    methodLabel: label,
    // Los datos de cobro solo se muestran mientras hay que pagar.
    instructions: stage === "to_pay" ? details : null,
    amountUsd: num(row.expected_amount_usd),
    amountArs: num(row.expected_amount_ars),
    deadlineAt: application.payment_deadline_at ?? null,
    reportedPaidAt: row.student_reported_paid_at,
    hasProof: Boolean(row.student_proof_file_id),
    issueAt: issueOpen ? row.student_payment_issue_at : null,
  };
}
