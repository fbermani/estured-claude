import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyStudentByProfileId } from "@/lib/notifications/notifyStudent";
import { loadStudentShortName, notifyLinkedFamily } from "@/lib/family/notifyLinkedFamily";
import { collectionEnabledNotice, type CollectionPath } from "@/lib/applications/reservationCollectionChoice";

/**
 * Aviso in-app al estudiante y al familiar vinculado cuando la residencia habilita el pago de la reserva (DR63 (d) y (m)). El texto
 * depende del camino (medios o contacto directo) y de si el estudiante es menor. NUNCA lleva datos de cobro: esos se ven dentro de la
 * solicitud. No promete disponibilidad. Nunca lanza.
 */
export async function notifyCollectionEnabled(
  admin: SupabaseClient,
  params: {
    applicationId: string;
    residenceId: string;
    studentProfileId: string;
    mode: CollectionPath;
    methodLabel: string | null;
    /** `application_requests.contact_target === "family_member"`: el estudiante es menor. */
    isMinor: boolean;
  },
): Promise<void> {
  try {
    const { data: residence } = await admin.from("residences").select("name").eq("id", params.residenceId).maybeSingle();
    const residenceName = (residence?.name as string | undefined) ?? "la residencia";
    const studentName = await loadStudentShortName(admin, params.studentProfileId);
    const common = {
      residenceName,
      mode: params.mode,
      methodLabel: params.methodLabel,
      isMinor: params.isMinor,
      studentName,
    };
    const related = { relatedEntityType: "application_requests", relatedEntityId: params.applicationId, category: "requests_reservations" as const };
    await notifyStudentByProfileId(admin, params.studentProfileId, { ...collectionEnabledNotice({ ...common, audience: "student" }), ...related });
    await notifyLinkedFamily(admin, params.studentProfileId, { ...collectionEnabledNotice({ ...common, audience: "family" }), ...related });
  } catch (error) {
    console.error("[notifications] notifyCollectionEnabled failed:", error);
  }
}
