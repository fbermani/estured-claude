import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";

export type UpdateSupportCaseStatusResult = { status: "ok" } | { status: "error"; message: string };

const VALID_STATUSES = [
  "opened",
  "submitted",
  "under_review",
  "needs_more_info",
  "waiting_other_party",
  "in_progress",
  "resolved_by_agreement",
  "closed_no_action",
  "closed_unresolved",
  "admin_action_taken",
];
const CLOSED_STATUSES = ["resolved_by_agreement", "closed_no_action", "closed_unresolved", "admin_action_taken"];
const VALID_OUTCOMES = [
  "closed_no_action",
  "warning",
  "agreement_between_parties",
  "estured_fee_refund",
  "alternative_recommended",
  "visibility_penalty",
  "suspension",
  "expulsion",
];

/**
 * Cambiar el estado de un caso de soporte (docs/12 Fase 14) — solo
 * admin. Al cerrar (uno de los 4 estados terminales), pide `outcome`
 * (uno de los 8 resultados posibles de docs/03 §22.4) y notas.
 *
 * Deliberadamente NO dispara ninguna acción automática según el
 * `outcome` elegido — "reembolso del fee", "suspensión" o "expulsión"
 * son etiquetas descriptivas de qué pasó, no triggers. El admin ejecuta
 * esas acciones con las herramientas ya existentes (revokeEsturedFee,
 * setResidencePausedByAdmin, setUserBlockedStatus) y deja constancia acá
 * — decisión explícita del dueño (Ciclo 34quindecies) para no acoplar
 * un formulario de soporte con flujos de dinero ya probados.
 */
export async function updateSupportCaseStatus(
  admin: SupabaseClient,
  params: {
    supportCaseId: string;
    actorUserId: string;
    actorRole: string;
    newStatus: string;
    outcome: string | null;
    notes: string;
  },
): Promise<UpdateSupportCaseStatusResult> {
  if (!VALID_STATUSES.includes(params.newStatus)) return { status: "error", message: "Estado inválido." };
  const notes = params.notes.trim();
  const isClosing = CLOSED_STATUSES.includes(params.newStatus);
  if (isClosing) {
    if (!params.outcome || !VALID_OUTCOMES.includes(params.outcome)) {
      return { status: "error", message: "Elegí un resultado para cerrar el caso." };
    }
    if (notes.length < 5) return { status: "error", message: "Dejá una nota explicando la resolución." };
  }

  const { data: supportCase } = await admin
    .from("support_cases")
    .select("id, status, opened_by_user_id, related_entity_type, residences(name)")
    .eq("id", params.supportCaseId)
    .maybeSingle();
  if (!supportCase) return { status: "error", message: "Caso no encontrado." };

  const { error } = await admin
    .from("support_cases")
    .update({
      status: params.newStatus,
      resolution_outcome: isClosing ? params.outcome : null,
      resolution_notes: notes || null,
      assigned_admin_user_id: params.actorUserId,
    })
    .eq("id", supportCase.id);
  if (error) {
    console.error("[support] updateSupportCaseStatus failed:", error);
    return { status: "error", message: "No pudimos actualizar el caso. Probá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    action: "support_case_status_updated",
    entityType: "support_cases",
    entityId: supportCase.id,
    oldValue: { status: supportCase.status },
    newValue: { status: params.newStatus, outcome: isClosing ? params.outcome : undefined },
    reasonText: notes || undefined,
    source: "admin",
  });

  if (isClosing) {
    const residenceName = (supportCase.residences as unknown as { name: string } | null)?.name;
    const subject = residenceName
      ? `sobre ${residenceName}`
      : supportCase.related_entity_type === "reservations"
        ? "sobre el pago del fee EstuRed"
        : "";
    await createNotification(admin, {
      userId: supportCase.opened_by_user_id,
      title: "Tu caso de soporte se resolvió",
      body: `El equipo de EstuRed cerró tu caso${subject ? ` ${subject}` : ""}. ${notes}`,
      relatedEntityType: "support_cases",
      relatedEntityId: supportCase.id,
    });
  }

  return { status: "ok" };
}
