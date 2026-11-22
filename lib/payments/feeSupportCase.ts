import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";

const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];

export type FeeSupportCaseResult = { ok: true; supportCaseId: string; created: boolean } | { ok: false };

/**
 * Caso de Soporte `estured_fee_payment` abierto por EstuRed (DR64 (d), (e) y (f); `docs/07` §17.9 y §17.10): «No recibí el pago»,
 * «Contactar al pagador» y la alerta de 72 h. Va a nombre del pagador designado (para que lo vea en `/students/support`) con
 * `opened_by_role = 'system'`, sin residencia y con la RESERVA como contexto, igual que `openFeePaymentSupportCase`. A diferencia de
 * esa función no pide cuota ni 20 caracteres escritos por una persona: la descripción es neutra y NUNCA lleva datos de cobro ni el
 * motivo que escribió el admin.
 *
 * Idempotente: único por reserva mientras haya uno abierto (búsqueda previa sin filtrar por quién lo abrió; un 23505 se trata como éxito
 * y devuelve el caso existente). El índice único parcial `support_cases_estured_fee_payment_open_uniq` (migración 0108) lo respalda en la base. Nunca lanza.
 */
export async function openFeeReviewSupportCase(
  admin: SupabaseClient,
  params: {
    reservationId: string;
    payerUserId: string;
    description: string;
    /** Quien lo dispara: el admin que actuó, o `null` si fue el sistema (job). */
    actorUserId: string | null;
    actorRole: string;
  },
): Promise<FeeSupportCaseResult> {
  try {
    const findOpen = async () => {
      const { data, error } = await admin
        .from("support_cases")
        .select("id, status")
        .eq("topic", "estured_fee_payment")
        .eq("related_entity_id", params.reservationId);
      return { open: (data ?? []).find((c) => !CLOSED_STATUSES.includes(c.status as string)), error };
    };

    const found = await findOpen();
    if (found.error) {
      console.error("[fee-support-case] lookup failed:", found.error.code, found.error.message);
      return { ok: false };
    }
    if (found.open) return { ok: true, supportCaseId: found.open.id as string, created: false };

    const { data: created, error } = await admin
      .from("support_cases")
      .insert({
        opened_by_user_id: params.payerUserId,
        opened_by_role: "system",
        topic: "estured_fee_payment",
        residence_id: null,
        related_entity_type: "reservations",
        related_entity_id: params.reservationId,
        description: params.description,
        terms_reminder_accepted_at: null,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      const raced = await findOpen();
      if (raced.open) return { ok: true, supportCaseId: raced.open.id as string, created: false };
      console.error("[fee-support-case] unique violation sin caso abierto:", error.message);
      return { ok: false };
    }
    if (error || !created) {
      console.error("[fee-support-case] insert failed:", error?.code, error?.message);
      return { ok: false };
    }
    const id = created.id as string;
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "support_case_opened",
      entityType: "support_cases",
      entityId: id,
      newValue: { topic: "estured_fee_payment", reservation_id: params.reservationId },
      source: params.actorUserId ? "admin" : "system",
      isSystemAction: params.actorUserId === null,
    });
    return { ok: true, supportCaseId: id, created: true };
  } catch (error) {
    console.error("[fee-support-case] threw:", error);
    return { ok: false };
  }
}
