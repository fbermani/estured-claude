import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { rowCan } from "@/lib/residences/permissions";

export type ProposalResponse = "accepted" | "rejected_chose_original" | "rejected_closed";

const COPY: Record<ProposalResponse, { title: string; body: string }> = {
  accepted: {
    title: "El estudiante aceptó tu propuesta de ajuste",
    body: "Las condiciones quedaron acordadas y se habilitó el pago a la residencia. Entrá a la solicitud para ver los pasos.",
  },
  rejected_chose_original: {
    title: "El estudiante eligió las condiciones originales",
    body: "No aceptó el ajuste y siguió con las condiciones originales. Entrá a la solicitud para ver los pasos.",
  },
  rejected_closed: {
    title: "El estudiante rechazó tu propuesta de ajuste",
    body: "La solicitud se cerró. Podés ver el detalle en la pantalla de solicitudes.",
  },
};

/**
 * Aviso al equipo de la residencia (dueño y staff con `applications.review_contact`) cuando el estudiante responde la propuesta de ajuste.
 * Hoy esa respuesta no avisaba a la residencia. In-app (y push de `requests_reservations`, que sale con texto genérico); el aviso in-app no lleva datos del estudiante. Nunca lanza.
 */
export async function notifyResidenceProposalResponse(
  admin: SupabaseClient,
  params: { applicationId: string; residenceId: string; response: ProposalResponse },
): Promise<void> {
  try {
    const { data: team } = await admin
      .from("residence_users")
      .select("user_id, role, permissions")
      .eq("residence_id", params.residenceId)
      .eq("is_active", true);
    const userIds = [
      ...new Set(
        ((team ?? []) as { user_id: string; role: string | null; permissions: unknown }[])
          .filter((r) => rowCan(r, "applications.review_contact"))
          .map((r) => r.user_id),
      ),
    ];
    if (userIds.length === 0) return;
    const copy = COPY[params.response];
    await Promise.all(
      userIds.map((userId) =>
        createNotification(admin, {
          userId,
          ...copy,
          relatedEntityType: "application_requests",
          relatedEntityId: params.applicationId,
          category: "requests_reservations",
        }),
      ),
    );
  } catch (error) {
    console.error("[notifications] notifyResidenceProposalResponse failed:", error);
  }
}
