import "server-only";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";
import { createInvitation, redeemInvitation, type ResolvedInvitation } from "@/lib/preapertura/invitations";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { isMissingAttributionColumn, type Attribution } from "@/lib/attribution/attribution";
import { PREAPERTURA_LEGAL } from "@/lib/legal/versions";

/**
 * Alta de cuentas REALES de la preapertura (DR43.1), mismo patrón que `registerStudent` / `registerFamily`: usuario de Auth
 * pre-confirmado + `users` + `user_roles` + perfil + consentimientos versionados + auditoría, y si algo falla a mitad de camino se
 * borra el usuario de Auth para no dejar cuentas huérfanas. Además crea la fila de `preapertura_estudiantes` (migración 0080).
 *
 * El paso 1 no pide nombre ni teléfono, pero `student_profiles` / `family_members` los exigen (NOT NULL): se guardan vacíos (el nombre se
 * completa en el paso 2; el apellido y la relación familiar se piden al abrir). Es un supuesto reversible, documentado en NEXT_STEPS.
 * Todo con service role y SIN loguear mails ni contraseñas.
 */
/** Versión de los Términos y la Privacidad de la preapertura (`lib/legal/versions.ts`). */
export const PREAPERTURA_CONSENT_VERSION: string = PREAPERTURA_LEGAL.version;

/** IP del cliente para trazabilidad (columna `inet`): solo si es una IP válida; cualquier otra cosa que mande el cliente se descarta. */
export function clientIpOf(headers: { get(name: string): string | null }): string | null {
  const platform = headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip");
  const candidate = (platform ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  return isIP(candidate) ? candidate : null;
}

export type AccountFailure = "email_exists" | "unavailable" | "failed";
export type AccountResult<T = object> = ({ ok: true; userId: string } & T) | { ok: false; reason: AccountFailure };

type Meta = { ip: string | null; userAgent: string | null; attribution?: Attribution | null };

async function createAuthUser(admin: SupabaseClient, email: string, password: string): Promise<{ userId: string } | { failure: AccountFailure }> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    if (error?.code === "email_exists") return { failure: "email_exists" };
    console.error("[preapertura] createUser failed:", error?.code ?? "sin código");
    return { failure: "failed" };
  }
  return { userId: data.user.id };
}

/** Si el error de una inserción es «falta la migración 0080» el flujo avisa que todavía no está disponible. */
function failureOf(error: unknown): AccountFailure {
  return isMissingSchemaError(error as { code?: string; message?: string }) ? "unavailable" : "failed";
}

/**
 * Inserta la fila de `preapertura_estudiantes` con la atribución de campaña (migración 0106) cuando hay. Si la columna todavía no
 * existe (código antes que la migración), reintenta sin ella: el alta nunca se rompe por la medición.
 */
async function insertPreapertura(admin: SupabaseClient, row: Record<string, unknown>, attribution: Attribution | null | undefined) {
  if (!attribution) return admin.from("preapertura_estudiantes").insert(row);
  const result = await admin.from("preapertura_estudiantes").insert({ ...row, attribution });
  if (result.error && isMissingAttributionColumn(result.error)) return admin.from("preapertura_estudiantes").insert(row);
  return result;
}

export async function createStudentAccount(
  admin: SupabaseClient,
  input: { email: string; password: string; birthDate: string; age: number; isMinor: boolean; invitation: ResolvedInvitation | null } & Meta,
): Promise<AccountResult> {
  const created = await createAuthUser(admin, input.email, input.password);
  if ("failure" in created) return { ok: false, reason: created.failure };
  const userId = created.userId;
  let failure: AccountFailure = "failed";
  try {
    const { error: userError } = await admin.from("users").insert({ id: userId, email: input.email, primary_role: "student" });
    if (userError) throw userError;
    const { error: roleError } = await admin.from("user_roles").insert({ user_id: userId, role: "student", scope_type: "global" });
    if (roleError) throw roleError;

    const { data: profile, error: profileError } = await admin
      .from("student_profiles")
      .insert({
        user_id: userId,
        first_name: "",
        last_name: "",
        last_initial: "",
        birth_date: input.birthDate,
        display_age: input.age,
        nationality: null,
        origin_city: null,
        study_institution_private: null,
        is_minor: input.isMinor,
      })
      .select("id")
      .single();
    if (profileError || !profile) throw profileError;

    // Visibilidad privada por defecto (docs/10 §9.2): la comunidad pública de la preapertura vive en `preapertura_estudiantes`.
    const { error: visibilityError } = await admin
      .from("student_visibility_settings")
      .insert({ student_profile_id: profile.id, is_individual_profile_visible: false });
    if (visibilityError) throw visibilityError;

    // El casillero único del paso 1 acepta Términos, Privacidad y la opción C (DR45.1): se guardan, versionados. EXCEPCIÓN: un menor
    // invitado (14 a 17) NO da la opción C (su búsqueda nunca se muestra a residencias) ni la comunidad pública: ni se registra ese
    // consentimiento ni queda `consent_c` en true. Un menor no puede consentir eso, ni siquiera dentro del casillero de Términos.
    const base = { user_id: userId, version: PREAPERTURA_CONSENT_VERSION, ip_address: input.ip, user_agent: input.userAgent };
    const consentRows: Record<string, unknown>[] = [
      { ...base, consent_type: "terms", metadata: { source: "preapertura" } },
      { ...base, consent_type: "privacy", metadata: { source: "preapertura" } },
    ];
    if (!input.isMinor) {
      consentRows.push({ ...base, consent_type: "search_visibility_to_verified_residences", metadata: { source: "preapertura", bundled_with_terms: true } });
    }
    const { error: consentError } = await admin.from("consents").insert(consentRows);
    if (consentError) throw consentError;

    const { error: preError } = await insertPreapertura(admin, {
      user_id: userId,
      role: "student",
      birth_date: input.birthDate,
      consent_c: !input.isMinor,
      consent_comunidad: false,
      invited_by_user_id: input.invitation?.inviterUserId ?? null,
    }, input.attribution);
    if (preError) {
      failure = failureOf(preError);
      throw preError;
    }

    if (input.invitation) {
      // Canje atómico: si otro lo usó en el mismo instante, esta cuenta no se queda.
      if (!(await redeemInvitation(admin, input.invitation.id, userId))) throw new Error("invitation_not_redeemed");
      // Cuentas conectadas (DR43.2): el vínculo queda PENDIENTE de aprobación del estudiante, igual que el registro familiar de siempre.
      // El familiar no da consentimientos por el estudiante y no aprueba nada por él.
      const { data: member, error: memberError } = await admin
        .from("family_members")
        .select("id")
        .eq("user_id", input.invitation.inviterUserId)
        .maybeSingle();
      if (memberError || !member) throw memberError ?? new Error("inviter_without_family_member");
      const { error: linkError } = await admin.from("family_links").insert({
        student_profile_id: profile.id,
        family_member_id: member.id,
        status: "pending_student_approval",
        requested_by_user_id: input.invitation.inviterUserId,
      });
      if (linkError) throw linkError;
    }

    await createAuditLog(admin, {
      actorUserId: userId,
      actorRole: "student",
      action: "preapertura_student_registered",
      entityType: "users",
      entityId: userId,
      newValue: { is_minor: input.isMinor, invited: Boolean(input.invitation), consent_c: !input.isMinor },
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });
  } catch (error) {
    console.error("[preapertura] student rollback:", (error as { code?: string } | null)?.code ?? "sin código");
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false, reason: failure };
  }
  // Aviso a admin (texto neutro, sin datos personales). Nunca lanza. No se duplica con `registerStudent`: ese flujo no llama a esta función.
  await notifyAdminsSafe(admin, {
    title: "Se registró un estudiante nuevo",
    body: "Hay una cuenta de estudiante nueva en EstuRed (preapertura).",
    entityType: "users",
    entityId: userId,
    category: "admin_signups",
  });
  return { ok: true, userId };
}

export async function createFamilyAccount(
  admin: SupabaseClient,
  input: { email: string; password: string; inviteeEmail: string; declaredAdult?: boolean } & Meta,
): Promise<AccountResult<{ inviteToken: string }>> {
  const created = await createAuthUser(admin, input.email, input.password);
  if ("failure" in created) return { ok: false, reason: created.failure };
  const userId = created.userId;
  let failure: AccountFailure = "failed";
  try {
    const { error: userError } = await admin.from("users").insert({ id: userId, email: input.email, primary_role: "family_member" });
    if (userError) throw userError;
    const { error: roleError } = await admin.from("user_roles").insert({ user_id: userId, role: "family_member", scope_type: "global" });
    if (roleError) throw roleError;

    // `family_members` exige nombre, apellido y relación (check: padre, madre, tutor, familiar): se completan al abrir; hoy 'familiar'.
    const { error: memberError } = await admin
      .from("family_members")
      .insert({ user_id: userId, first_name: "", last_name: "", relationship_type: "familiar", phone: null });
    if (memberError) throw memberError;

    // El familiar acepta Términos y Privacidad (sin la opción C: esa es del estudiante).
    const base = { user_id: userId, version: PREAPERTURA_CONSENT_VERSION, ip_address: input.ip, user_agent: input.userAgent };
    const { error: consentError } = await admin.from("consents").insert([
      { ...base, consent_type: "terms", metadata: { source: "preapertura" } },
      { ...base, consent_type: "privacy", metadata: { source: "preapertura" } },
    ]);
    if (consentError) throw consentError;

    const { error: preError } = await insertPreapertura(admin, { user_id: userId, role: "family", consent_c: false, consent_comunidad: false }, input.attribution);
    if (preError) {
      failure = failureOf(preError);
      throw preError;
    }

    // Una sola invitación por familiar (unique en la tabla).
    const invitation = await createInvitation(admin, userId, input.inviteeEmail);
    if (!invitation.ok) throw new Error("invitation_not_created");

    await createAuditLog(admin, {
      actorUserId: userId,
      actorRole: "family_member",
      action: "preapertura_family_registered_and_invited",
      entityType: "users",
      entityId: userId,
      newValue: { declared_adult: input.declaredAdult === true },
      ipAddress: input.ip,
      userAgent: input.userAgent,
    });
    return { ok: true, userId, inviteToken: invitation.token };
  } catch (error) {
    console.error("[preapertura] family rollback:", (error as { code?: string } | null)?.code ?? "sin código");
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false, reason: failure };
  }
}
