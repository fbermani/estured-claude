"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { publishRegulationPdfVersion, publishRegulationVersion } from "@/lib/regulations/publish";

export type PublishRegulationState = { status: "idle" | "published" | "error"; message?: string };

/**
 * Publicar una versión nueva del reglamento (DR14). El permiso (`profile.edit`), la validación del texto y la auditoría viven en
 * `lib/regulations/publish`. Sin revisión del admin: rige apenas se publica.
 */
export async function publishRegulationAction(
  residenceId: string,
  _prev: PublishRegulationState,
  formData: FormData,
): Promise<PublishRegulationState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const result = await publishRegulationVersion(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    text: formData.get("text"),
    source: formData.get("source"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/regulation`);
  revalidatePath("/residencias/[slug]", "page");
  return { status: "published", message: `Publicaste la versión ${result.versionNumber}. Rige para las solicitudes nuevas.` };
}

/** Publicar como versión un reglamento propio en PDF (DR59 a). Tope 5 MB; validación y permiso en `lib/regulations/publish`. */
export async function publishRegulationPdfAction(
  residenceId: string,
  _prev: PublishRegulationState,
  formData: FormData,
): Promise<PublishRegulationState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const result = await publishRegulationPdfVersion(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    file: formData.get("regulation_pdf"),
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/regulation`);
  revalidatePath("/residencias/[slug]", "page");
  return { status: "published", message: `Publicaste la versión ${result.versionNumber} (PDF). Rige para las solicitudes nuevas.` };
}
