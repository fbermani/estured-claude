import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";

const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];
const SCHEMA_MISSING_CODES = new Set(["23514", "42703", "PGRST204"]);

export type ResidencePaymentCaseResult =
  | { ok: true; supportCaseId: string; created: boolean }
  /** La migración 0103 no está aplicada (el CHECK de `topic` no admite `residence_payment`): se sigue sin caso. */
  | { ok: false; schemaMissing: true }
  | { ok: false; schemaMissing: false };

/**
 * Caso de Soporte del pago a la residencia (DR63 (j) 1; migración 0103, `topic = 'residence_payment'`): lo abre la residencia al registrar
 * «No recibí el pago», o el sistema (a nombre del estudiante, `opened_by_role = 'system'`) cuando a las 72 h la residencia no confirmó.
 * A diferencia de `openSupportCase` no pasa por la cuota por usuario ni pide recordatorio de términos al sistema: la descripción es
 * neutra y NUNCA lleva datos de cobro. Idempotente: no abre un segundo caso mientras haya uno abierto para la solicitud. Avisa al admin.
 */
export async function openResidencePaymentSupportCase(
  admin: SupabaseClient,
  params: {
    applicationId: string;
    residenceId: string;
    openedByUserId: string;
    openedByRole: string;
    description: string;
    /** Solo cuando una persona aceptó el recordatorio de términos al abrirlo (la residencia). El sistema lo deja vacío. */
    termsAcceptedAt?: string | null;
    auditSource: "user" | "system";
  },
): Promise<ResidencePaymentCaseResult> {
  try {
    const { data: existing, error: lookupError } = await admin
      .from("support_cases")
      .select("id, status")
      .eq("topic", "residence_payment")
      .eq("related_entity_id", params.applicationId);
    if (lookupError) {
      if (SCHEMA_MISSING_CODES.has(lookupError.code ?? "")) return { ok: false, schemaMissing: true };
      console.error("[residence-payment-case] lookup failed:", lookupError.code, lookupError.message);
      return { ok: false, schemaMissing: false };
    }
    const open = (existing ?? []).find((c) => !CLOSED_STATUSES.includes(c.status as string));
    if (open) return { ok: true, supportCaseId: open.id as string, created: false };

    const { data: created, error } = await admin
      .from("support_cases")
      .insert({
        opened_by_user_id: params.openedByUserId,
        opened_by_role: params.openedByRole,
        topic: "residence_payment",
        residence_id: params.residenceId,
        related_entity_type: "application_requests",
        related_entity_id: params.applicationId,
        description: params.description,
        terms_reminder_accepted_at: params.termsAcceptedAt ?? null,
      })
      .select("id")
      .single();
    if (error || !created) {
      if (SCHEMA_MISSING_CODES.has(error?.code ?? "")) {
        console.error("[residence-payment-case] insert rechazado (¿migración 0103 sin aplicar?):", error?.code);
        return { ok: false, schemaMissing: true };
      }
      console.error("[residence-payment-case] insert failed:", error?.code, error?.message);
      return { ok: false, schemaMissing: false };
    }
    const id = created.id as string;
    await createAuditLog(admin, {
      actorUserId: params.auditSource === "user" ? params.openedByUserId : null,
      actorRole: params.openedByRole,
      action: "support_case_opened",
      entityType: "support_cases",
      entityId: id,
      newValue: { topic: "residence_payment", application_request_id: params.applicationId },
      source: params.auditSource,
      isSystemAction: params.auditSource === "system",
    });
    await notifyAdminsSafe(admin, {
      title: "Pago a la residencia sin resolver",
      body: "Se abrió un caso de Soporte por un pago a la residencia. Revisalo en el panel.",
      entityType: "support_cases",
      entityId: id,
    });
    return { ok: true, supportCaseId: id, created: true };
  } catch (error) {
    console.error("[residence-payment-case] threw:", error);
    return { ok: false, schemaMissing: false };
  }
}
