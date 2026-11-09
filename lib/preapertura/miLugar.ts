import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CHIPS } from "@/lib/preapertura/options";
import { profileProgress } from "@/lib/preapertura/validation";
import { firstNameOnly } from "@/lib/preapertura/communityRail";

/**
 * Datos de «Mi lugar» (SPEC pantalla 5). Todo con service role, SIEMPRE por el `user_id` de la sesión (nunca de un parámetro del cliente).
 * El familiar ve de su invitación solo el mail enmascarado, el estado y, si ya la canjeó, el nombre de pila del estudiante.
 */

/** «lucia@gmail.com» -> «lu•••@gmail.com». Nunca devuelve el mail completo. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}•••${email.slice(at)}`;
}

type ProfileFields = {
  first_name: string | null;
  country: string | null;
  university: string | null;
  career: string | null;
  entry_month: number | null;
  entry_unsure: boolean;
  room_type: string | null;
  habits: string[] | null;
  interests: string[] | null;
};

/** Mismo medidor del paso 2: arranca en 10 % por tener la cuenta y suma con cada dato. */
export function profilePercentOf(row: ProfileFields): number {
  return profileProgress({
    name: Boolean(row.first_name?.trim()),
    country: Boolean(row.country),
    university: Boolean(row.university),
    career: Boolean(row.career),
    entry: Boolean(row.entry_month) || row.entry_unsure,
    roomType: Boolean(row.room_type),
    habits: (row.habits?.length ?? 0) === MAX_CHIPS,
    interests: (row.interests?.length ?? 0) === MAX_CHIPS,
  });
}

export type FamilyInvitationView = {
  maskedEmail: string;
  status: "pending" | "linked" | "expired";
  /** Solo con la invitación canjeada y si el estudiante ya cargó su nombre. */
  studentFirstName: string | null;
};

export type MiLugarData = {
  /** `null` = cuenta que no nació en la preapertura (sin fila): se muestra la versión básica. */
  role: "student" | "family" | null;
  firstName: string | null;
  createdAt: string | null;
  profilePercent: number | null;
  invitation: FamilyInvitationView | null;
};

const COLUMNS = "role, created_at, first_name, country, university, career, entry_month, entry_unsure, room_type, habits, interests";

export async function loadMiLugar(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<MiLugarData> {
  const { data } = await admin.from("preapertura_estudiantes").select(COLUMNS).eq("user_id", userId).maybeSingle();
  const row = data as (ProfileFields & { role: string; created_at: string }) | null;
  if (!row) return { role: null, firstName: null, createdAt: null, profilePercent: null, invitation: null };

  if (row.role === "student") {
    return { role: "student", firstName: firstNameOnly(row.first_name) || null, createdAt: row.created_at, profilePercent: profilePercentOf(row), invitation: null };
  }

  let invitation: FamilyInvitationView | null = null;
  const { data: inv } = await admin
    .from("preapertura_invitaciones")
    .select("invitee_email, expires_at, redeemed_at, redeemed_by_user_id")
    .eq("inviter_user_id", userId)
    .maybeSingle();
  if (inv) {
    const i = inv as { invitee_email: string; expires_at: string; redeemed_at: string | null; redeemed_by_user_id: string | null };
    let studentFirstName: string | null = null;
    if (i.redeemed_at && i.redeemed_by_user_id) {
      const { data: kid } = await admin.from("preapertura_estudiantes").select("first_name").eq("user_id", i.redeemed_by_user_id).maybeSingle();
      studentFirstName = firstNameOnly((kid as { first_name: string | null } | null)?.first_name) || null;
    }
    invitation = {
      maskedEmail: maskEmail(i.invitee_email),
      status: i.redeemed_at ? "linked" : new Date(i.expires_at).getTime() <= now.getTime() ? "expired" : "pending",
      studentFirstName,
    };
  }
  return { role: "family", firstName: null, createdAt: row.created_at, profilePercent: null, invitation };
}
