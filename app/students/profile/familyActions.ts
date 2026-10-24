"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { parseFamilyProfileInput, type FamilyProfileErrors } from "@/lib/family/familyProfile";
import { saveFamilyProfile } from "@/lib/family/updateFamilyProfile";

export type UpdateFamilyProfileState = {
  status: "idle" | "error" | "saved";
  message?: string;
  fieldErrors?: FamilyProfileErrors;
  /** Lo que escribió la persona, para no perderlo al volver el error (React resetea los campos tras la acción). */
  values?: Record<string, string>;
};

const FORM_FIELDS = ["first_name", "last_name", "phone", "relationship_type", "billing_tax_id", "billing_vat_condition"];

/** Perfil propio del familiar (DR4). Solo edita SU fila de `family_members`: el id sale de la sesión, nunca del formulario. */
export async function updateFamilyProfile(
  _prev: UpdateFamilyProfileState,
  formData: FormData,
): Promise<UpdateFamilyProfileState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!sessionUser.roles.includes("family_member")) {
    return { status: "error", message: "Esta pantalla es solo para familiares." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };

  const parsed = parseFamilyProfileInput(formData);
  if (!parsed.ok) {
    const values = Object.fromEntries(FORM_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
    return { status: "error", message: "Revisá los campos marcados.", fieldErrors: parsed.errors, values };
  }

  const result = await saveFamilyProfile(admin, { userId: sessionUser.id, input: parsed.values });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/profile");
  return { status: "saved", message: result.warning ?? "Guardamos tu perfil." };
}
