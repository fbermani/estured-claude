import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/createNotification";
import { getRegulationGate } from "@/lib/regulations/gate";

/**
 * Aviso in-app al familiar vinculado cuando la solicitud de un estudiante MENOR queda esperando la aceptación del reglamento
 * (DR62 c). Quien acepta es el familiar con vínculo activo, desde `/students/applications/[id]`. Nunca lanza (un aviso que falla no
 * puede tumbar la solicitud). Si el estudiante es mayor o no hay familiar vinculado, no hace nada.
 */
export async function notifyGuardianRegulationPending(
  admin: SupabaseClient,
  params: { applicationId: string; studentProfileId: string },
): Promise<void> {
  try {
    // Solo si la solicitud quedó realmente esperando la aceptación (sin la migración 0053 no hay bloqueo ni aviso).
    const gate = await getRegulationGate(admin, params.applicationId);
    if (!gate.pending || gate.checkFailed) return;
    const { data: profile } = await admin.from("student_profiles").select("is_minor").eq("id", params.studentProfileId).maybeSingle();
    if ((profile as { is_minor?: boolean } | null)?.is_minor !== true) return;
    const { data: link } = await admin
      .from("family_links")
      .select("family_members(user_id)")
      .eq("student_profile_id", params.studentProfileId)
      .eq("status", "active")
      .maybeSingle();
    const member = (link as { family_members?: { user_id?: string | null } | null } | null)?.family_members;
    if (!member?.user_id) return;
    await createNotification(admin, {
      userId: member.user_id,
      title: "Falta que aceptes el reglamento",
      body: "Hay una solicitud de tu familiar menor de edad esperando que leas y aceptes el reglamento de la residencia. Hasta entonces la residencia no puede avanzarla.",
      relatedEntityType: "application_requests",
      relatedEntityId: params.applicationId,
    });
  } catch (error) {
    console.error("[regulations] guardian notice failed:", error);
  }
}
