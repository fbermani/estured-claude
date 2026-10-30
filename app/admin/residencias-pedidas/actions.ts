"use server";

import { revalidatePath } from "next/cache";
import { adminActorRole, getAdminSession } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { markMissingResidenceContacted } from "@/lib/residents/missingResidencesAdmin";

/** «Contactada»: el admin ya le escribió a mano a la residencia. Botón nativo con `<form action>`; sin envío automático. */
export async function markContactedAction(formData: FormData): Promise<void> {
  const user = await getAdminSession();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return;
  const ids = String(formData.get("ids") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  await markMissingResidenceContacted(admin, { actorUserId: user.id, actorRole: adminActorRole(user), ids });
  revalidatePath("/admin/residencias-pedidas");
}
