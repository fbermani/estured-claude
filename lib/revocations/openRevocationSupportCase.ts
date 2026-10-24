import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

/**
 * Caso de Soporte automático al revocar el fee (DR6, docs/04 §8.9, docs/07 §18.6): `topic = 'fee_revocation'`, sin residencia
 * (la residencia nunca lo ve) y con la reserva como contexto (migración 0049). Lo abre quien revoca (estudiante o pagador) para que
 * el admin lo revise junto con la resolución. BEST-EFFORT: si falla (migración sin aplicar, base caída) se loguea y la revocación
 * del estudiante sigue valiendo; nunca lanza. Idempotente: no duplica el caso si ya hay uno abierto para la reserva.
 */
export async function openFeeRevocationSupportCase(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    actorRole: "student" | "family_member";
    reservationId: string;
    residenceName: string | null;
    studentReason: string | null;
  },
): Promise<{ ok: true; supportCaseId: string } | { ok: false }> {
  try {
    const { data: existing, error: lookupError } = await admin
      .from("support_cases")
      .select("id, status")
      .eq("topic", "fee_revocation")
      .eq("related_entity_id", params.reservationId);
    if (lookupError) {
      if (!isMissingSchemaError(lookupError)) console.error("[revocation] support case lookup failed:", lookupError);
      return { ok: false };
    }
    const alreadyOpen = (existing ?? []).find((c) => !CLOSED_STATUSES.includes(c.status as string));
    if (alreadyOpen) return { ok: true, supportCaseId: alreadyOpen.id as string };

    const where = params.residenceName ? ` en ${params.residenceName}` : "";
    const description =
      `Revocación del fee EstuRed de la reserva${where}, ejercida dentro del plazo de 10 días corridos. EstuRed revisa el caso.` +
      (params.studentReason ? ` Motivo indicado: ${params.studentReason}` : "");

    const { data: supportCase, error } = await admin
      .from("support_cases")
      .insert({
        opened_by_user_id: params.actorUserId,
        opened_by_role: params.actorRole,
        topic: "fee_revocation",
        residence_id: null,
        related_entity_type: "reservations",
        related_entity_id: params.reservationId,
        description,
        terms_reminder_accepted_at: null,
      })
      .select("id")
      .single();
    if (error || !supportCase) {
      // 0049 sin aplicar: el CHECK de `topic` todavía no admite `fee_revocation`.
      console.error("[revocation] support case insert failed (¿migración 0049 sin aplicar?):", error?.code, error?.message);
      return { ok: false };
    }

    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "support_case_opened",
      entityType: "support_cases",
      entityId: supportCase.id as string,
      newValue: { topic: "fee_revocation", reservation_id: params.reservationId },
      source: "user",
    });
    return { ok: true, supportCaseId: supportCase.id as string };
  } catch (e) {
    console.error("[revocation] support case open threw:", e);
    return { ok: false };
  }
}
