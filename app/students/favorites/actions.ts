"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { toggleFavorite } from "@/lib/students/favorites";

export type ToggleFavoriteState = { status: "idle" | "error"; favorited?: boolean; message?: string };

/** Estudiante guarda/quita una residencia de sus favoritos. */
export async function toggleStudentFavorite(
  residenceId: string,
  _prev: ToggleFavoriteState,
  _formData: FormData,
): Promise<ToggleFavoriteState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: profile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!profile) return { status: "error", message: "No encontramos tu perfil de estudiante." };

  const result = await toggleFavorite(admin, {
    studentProfileId: profile.id,
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: "student",
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/favorites");
  revalidatePath(`/residencias`);
  return { status: "idle", favorited: result.favorited };
}

/** Familiar vinculado sugiere/quita una residencia de los favoritos de SU estudiante. */
export async function toggleFamilyFavorite(
  residenceId: string,
  studentProfileId: string,
  _prev: ToggleFavoriteState,
  _formData: FormData,
): Promise<ToggleFavoriteState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const { data: familyMember } = await admin
    .from("family_members")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!familyMember) return { status: "error", message: "No encontramos tu perfil de familiar." };

  const { data: link } = await admin
    .from("family_links")
    .select("id")
    .eq("family_member_id", familyMember.id)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) return { status: "error", message: "No tenés un vínculo activo con ese estudiante." };

  const result = await toggleFavorite(admin, {
    studentProfileId,
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: "family_member",
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath("/students/favorites");
  return { status: "idle", favorited: result.favorited };
}
