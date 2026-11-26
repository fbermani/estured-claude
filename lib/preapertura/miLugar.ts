import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_CHIPS } from "@/lib/preapertura/options";
import { profileProgress } from "@/lib/preapertura/validation";
import { firstNameOnly } from "@/lib/preapertura/communityRail";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

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

/** Los 6 datos obligatorios del perfil (DR67). «Todavía no sé» cuenta como mes. */
export function isProfileComplete(row: ProfileFields): boolean {
  return Boolean(row.first_name?.trim() && row.country && row.university && row.career && (row.entry_month || row.entry_unsure) && row.room_type);
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
  /** `true` solo en un estudiante con los datos obligatorios cargados. */
  profileComplete: boolean;
  /** Número fijo desde 11 (DR67). `null` en familiares, cuentas sin fila o sin la migración 0111. */
  registrationNumber: number | null;
  invitation: FamilyInvitationView | null;
};

const COLUMNS = "role, created_at, first_name, country, university, career, entry_month, entry_unsure, room_type, habits, interests";

type MiLugarRow = ProfileFields & { role: string; created_at: string; registration_number?: number | null };

/** La fila propia. Sin la columna del número (0111 sin aplicar) se repite sin ella, para no dejar «Mi lugar» vacío. */
async function loadRow(admin: SupabaseClient, userId: string): Promise<MiLugarRow | null> {
  const query = (columns: string) => admin.from("preapertura_estudiantes").select(columns).eq("user_id", userId).maybeSingle();
  let result = await query(`${COLUMNS}, registration_number`);
  if (isMissingSchemaError(result.error)) result = await query(COLUMNS);
  return result.data as MiLugarRow | null;
}

export async function loadMiLugar(admin: SupabaseClient, userId: string, now: Date = new Date()): Promise<MiLugarData> {
  const row = await loadRow(admin, userId);
  if (!row) return { role: null, firstName: null, createdAt: null, profilePercent: null, profileComplete: false, registrationNumber: null, invitation: null };

  if (row.role === "student") {
    return {
      role: "student",
      firstName: firstNameOnly(row.first_name) || null,
      createdAt: row.created_at,
      profilePercent: profilePercentOf(row),
      profileComplete: isProfileComplete(row),
      registrationNumber: row.registration_number ?? null,
      invitation: null,
    };
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
  return { role: "family", firstName: null, createdAt: row.created_at, profilePercent: null, profileComplete: false, registrationNumber: null, invitation };
}
