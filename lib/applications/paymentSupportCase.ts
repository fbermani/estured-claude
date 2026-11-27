import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertResidencePermission } from "@/lib/residences/access";
import { resolvePaymentActor } from "@/lib/applications/studentPaymentAccess";
import { openResidencePaymentSupportCase } from "@/lib/applications/residencePaymentSupportCase";

/**
 * DR73: un caso de Soporte abierto sobre el pago de la reserva frena el vencimiento de 48 h de esa solicitud.
 *
 *  - `loadOpenPaymentCaseIds`: qué solicitudes tienen un caso `residence_payment` abierto. La usa el job de vencimiento y las pantallas.
 *  - `openPaymentSupportCaseCore`: «Abrir un caso en Soporte» desde la solicitud (decisión del dueño, 2026-11-27). Lo abren el estudiante,
 *    el familiar pagador de un menor o la residencia (permiso `payments.residence`). El actor y el estado salen de la base.
 */

export const PAYMENT_CASE_CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];
const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

export const PAYMENT_CASE_DESCRIPTION_MIN = 20;
export const PAYMENT_CASE_DESCRIPTION_MAX = 2000;

/** Ids de solicitudes con un caso de pago abierto. `null` si no se pudo leer: quien vence no vence nada. */
export async function loadOpenPaymentCaseIds(admin: SupabaseClient, applicationIds: string[]): Promise<Set<string> | null> {
  if (applicationIds.length === 0) return new Set();
  const { data, error } = await admin
    .from("support_cases")
    .select("related_entity_id, status")
    .eq("topic", "residence_payment")
    .eq("related_entity_type", "application_requests")
    .in("related_entity_id", applicationIds);
  if (error) {
    // Sin las columnas de Soporte (0040/0103) no hay casos de pago posibles.
    if (SCHEMA_MISSING_CODES.has(error.code ?? "")) return new Set();
    console.error("[payment-case] open cases read failed:", error.code, error.message);
    return null;
  }
  return new Set(
    ((data ?? []) as { related_entity_id: string; status: string }[])
      .filter((c) => !PAYMENT_CASE_CLOSED_STATUSES.includes(c.status))
      .map((c) => c.related_entity_id),
  );
}

export function validatePaymentCaseDescription(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof input === "string" ? input.trim() : "";
  if (text.length < PAYMENT_CASE_DESCRIPTION_MIN) return { ok: false, error: `Contanos qué pasó en al menos ${PAYMENT_CASE_DESCRIPTION_MIN} caracteres.` };
  if (text.length > PAYMENT_CASE_DESCRIPTION_MAX) return { ok: false, error: `La descripción es demasiado larga (máximo ${PAYMENT_CASE_DESCRIPTION_MAX} caracteres).` };
  return { ok: true, value: text };
}

export type OpenPaymentCaseResult = { ok: true; alreadyOpen: boolean } | { ok: false; error: string };

const NOT_FOUND = "No encontramos esa solicitud.";
const NOT_PENDING = "Esta solicitud ya no está esperando el pago de la reserva.";
const FAILED = "No pudimos abrir el caso. Intentá de nuevo en unos minutos o escribí a Soporte.";
const CLOSED_PAYMENT = new Set(["reported_received_by_residence", "expired"]);

export async function openPaymentSupportCaseCore(
  admin: SupabaseClient,
  params: { actorUserId: string; applicationId: string; side: "student" | "residence"; description: unknown; termsAccepted: boolean },
): Promise<OpenPaymentCaseResult> {
  const description = validatePaymentCaseDescription(params.description);
  if (!description.ok) return { ok: false, error: description.error };
  if (!params.termsAccepted) return { ok: false, error: "Confirmá que leíste el alcance de Soporte antes de continuar." };

  let residenceId: string;
  let openedByRole: string;
  if (params.side === "student") {
    const actor = await resolvePaymentActor(admin, params.actorUserId, params.applicationId);
    if (!actor.ok) return { ok: false, error: actor.reason === "read_failed" ? FAILED : NOT_FOUND };
    if (actor.application.status !== "residence_payment_pending") return { ok: false, error: NOT_PENDING };
    residenceId = actor.application.residence_id;
    openedByRole = actor.role === "student" ? "student" : "family_member";
  } else {
    const { data: app, error } = await admin.from("application_requests").select("id, status, residence_id").eq("id", params.applicationId).maybeSingle();
    if (error) return { ok: false, error: FAILED };
    if (!app) return { ok: false, error: NOT_FOUND };
    const access = await assertResidencePermission(admin, params.actorUserId, app.residence_id as string, "payments.residence");
    if (!access.ok) return { ok: false, error: access.error };
    if (app.status !== "residence_payment_pending") return { ok: false, error: NOT_PENDING };
    residenceId = app.residence_id as string;
    openedByRole = access.actorRole;
  }

  const { data: payment, error: paymentError } = await admin
    .from("external_residence_payments")
    .select("status")
    .eq("application_request_id", params.applicationId)
    .maybeSingle();
  if (paymentError) return { ok: false, error: FAILED };
  if (payment && CLOSED_PAYMENT.has(payment.status as string)) return { ok: false, error: NOT_PENDING };

  const opened = await openResidencePaymentSupportCase(admin, {
    applicationId: params.applicationId,
    residenceId,
    openedByUserId: params.actorUserId,
    openedByRole,
    description: description.value,
    termsAcceptedAt: new Date().toISOString(),
    auditSource: "user",
  });
  if (!opened.ok) return { ok: false, error: FAILED };

  // Carrera con el job de vencimiento: si la solicitud venció mientras se abría, el caso queda (Soporte lo atiende), pero se avisa.
  const { data: still } = await admin.from("application_requests").select("status").eq("id", params.applicationId).maybeSingle();
  if (still && still.status !== "residence_payment_pending") {
    return { ok: false, error: "La solicitud venció mientras abrías el caso. Soporte igual lo va a revisar." };
  }
  return { ok: true, alreadyOpen: !opened.created };
}
