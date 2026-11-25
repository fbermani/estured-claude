"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { consentVersion } from "@/lib/legal/consentVersion";
import { clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { GUARDIAN_CONSENT_TYPE, guardianConsentMissing } from "@/lib/students/minorHold";

export type GuardianConsentState = { status: "idle" | "error" | "saved"; message?: string };

/**
 * DR65 (e): el familiar con vínculo ACTIVO con un estudiante menor da su consentimiento (TP-07). Saca la cuenta del menor de la espera.
 * Todo se valida en el servidor: rol, vínculo activo con ESE perfil, minoría por `birth_date` y casilla marcada. Idempotente.
 */
export async function giveGuardianConsent(
  studentProfileId: string,
  _prev: GuardianConsentState,
  formData: FormData,
): Promise<GuardianConsentState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !sessionUser.roles.includes("family_member")) {
    return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  }
  if (formData.get("accept_guardian_consent") !== "on") {
    return { status: "error", message: "Marcá la casilla para dar tu consentimiento." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const { data: familyMember } = await admin.from("family_members").select("id").eq("user_id", sessionUser.id).maybeSingle();
  if (!familyMember) return { status: "error", message: "No encontramos tu perfil de familiar." };
  const { data: link } = await admin
    .from("family_links")
    .select("id")
    .eq("family_member_id", familyMember.id)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) return { status: "error", message: "No tenés un vínculo activo con ese estudiante." };

  if (!(await guardianConsentMissing(admin, studentProfileId, sessionUser.id))) {
    return { status: "saved" };
  }

  const headerStore = await headers();
  const { error } = await admin.from("consents").insert({
    user_id: sessionUser.id,
    consent_type: GUARDIAN_CONSENT_TYPE,
    version: consentVersion(GUARDIAN_CONSENT_TYPE),
    ip_address: clientIpFromHeaders(headerStore),
    user_agent: headerStore.get("user-agent"),
    related_entity_type: "student_profiles",
    related_entity_id: studentProfileId,
    metadata: { family_link_id: link.id },
  });
  if (error) {
    console.error("[guardian-consent] insert failed:", error.code);
    return { status: "error", message: "No pudimos registrar tu consentimiento. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "family_member",
    action: "guardian_consent_given",
    entityType: "student_profiles",
    entityId: studentProfileId,
    newValue: { family_link_id: link.id },
  });
  const { data: student } = await admin.from("student_profiles").select("user_id").eq("id", studentProfileId).maybeSingle();
  if (student?.user_id) {
    await createNotification(admin, {
      userId: student.user_id as string,
      title: "Tu cuenta ya está activa",
      body: "Tu familiar responsable dio su consentimiento. Ya podés completar tu perfil y enviar solicitudes.",
      relatedEntityType: "student_profiles",
      relatedEntityId: studentProfileId,
    });
  }
  revalidatePath("/students", "layout");
  return { status: "saved" };
}
