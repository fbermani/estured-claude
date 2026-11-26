"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { readAttribution } from "@/lib/attribution/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";
import { createAuditLog } from "@/lib/audit";
import { validatePassword } from "@/lib/auth/password";
import { COMMUNITY_RAIL_TAG } from "@/lib/preapertura/communityRailData";
import { DEV_BIRTH_DATE, devAutoAccountsEnabled, devCredentials } from "@/lib/preapertura/devAccounts";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { PREAPERTURA_CONSENT_VERSION, clientIpOf, createStudentAccount } from "@/lib/preapertura/accounts";
import { INVITE_MESSAGES, resolveInvitation, type ResolvedInvitation } from "@/lib/preapertura/invitations";
import { PREAPERTURA_TOO_MANY_ATTEMPTS, profileSaveAllowed, signupAllowed } from "@/lib/preapertura/throttle";
import { checkBirthDate, isPlausibleEmail, normalizeEmail, validateProfile } from "@/lib/preapertura/validation";
import { clientIpFromHeaders } from "@/lib/receipts/verifyRateLimit";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstile } from "@/lib/security/turnstile";
import { isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";
import type { ProfileState, Step1State } from "@/lib/preapertura/formState";

const UNAVAILABLE = "La preapertura todavía no está disponible. Probá de nuevo más tarde.";
const GENERIC = "No pudimos crear tu cuenta. Intentá de nuevo en unos minutos.";

function stepError(message: string, values: Step1State["values"], field?: string, code?: Step1State["code"]): Step1State {
  return { status: "error", message, values, ...(field ? { fieldErrors: { [field]: message } } : {}), ...(code ? { code } : {}) };
}

/**
 * Paso 1 de la preapertura (DR43.1): crea una cuenta REAL de estudiante (Auth + `users` + rol + perfil + consentimientos +
 * `preapertura_estudiantes`). Validación 100 % de servidor: la fecha de nacimiento fija la edad (18+ para cuenta propia, DR43.2);
 * un menor SIN invitación no crea cuenta y recibe el estado `minor`. Con invitación familiar el mail sale de la invitación (nunca
 * del formulario) y un menor de 14 a 17 entra salteando ese bloqueo, sin poder activar la comunidad.
 */
export async function registerStudentStep1(_prev: Step1State, formData: FormData): Promise<Step1State> {
  if (!isPreaperturaOn()) return stepError(UNAVAILABLE, undefined);
  const headerStore = await headers();
  const invitationToken = String(formData.get("invitacion") ?? "").trim();
  let typedEmail = normalizeEmail(formData.get("email"));
  let password = String(formData.get("password") ?? "");
  let birthRaw = String(formData.get("birth_date") ?? "").trim();
  let acceptTerms = formData.get("accept_terms") === "on";

  // SOLO DESARROLLO: el envío completamente vacío crea una cuenta de prueba (`test-preap-est-…@estured.test`, 18+, términos aceptados) y
  // sigue a «Mi lugar». Con cualquier campo escrito, con invitación, o fuera de desarrollo (producción y tests), la validación normal queda intacta.
  const devAuto = devAutoAccountsEnabled() && !invitationToken && !typedEmail && !password && !birthRaw;
  if (devAuto) {
    const creds = devCredentials("est");
    typedEmail = creds.email;
    password = creds.password;
    birthRaw = DEV_BIRTH_DATE;
    acceptTerms = true;
  }
  const values = { email: typedEmail, birth_date: birthRaw };

  const admin = getSupabaseAdmin();
  if (!admin) return stepError(UNAVAILABLE, values);

  let invitation: ResolvedInvitation | null = null;
  if (invitationToken) {
    const resolved = await resolveInvitation(admin, invitationToken);
    if (!resolved.ok) return stepError(INVITE_MESSAGES[resolved.reason], values);
    invitation = resolved.invitation;
  }
  // Con invitación, el mail es el de la invitación (el link es la prueba, igual que DR19): lo que llegue del formulario no cuenta.
  const email = invitation ? normalizeEmail(invitation.email) : typedEmail;

  if (!isPlausibleEmail(email)) return stepError("Escribí un email completo, por ejemplo nombre@gmail.com.", values, "email");
  const passwordError = validatePassword(password);
  if (passwordError) return stepError(passwordError, values, "password");

  const birth = checkBirthDate(birthRaw, { invited: Boolean(invitation) });
  if (birth.kind === "invalid") return stepError(birth.message, values, "birth_date");
  // Menor de 18 sin invitación: NO se crea cuenta ni se guarda nada (DR43.2).
  if (birth.kind === "minor_blocked") {
    return { status: "minor", values, fieldErrors: { birth_date: "Tenés menos de 18 años." } };
  }

  if (!acceptTerms) return stepError("Necesitamos que aceptes los Términos y la Privacidad para sumarte.", values, "accept_terms");

  // CAPTCHA solo en el alta abierta: con invitación familiar el token ya gatea el alta.
  if (!invitation && !(await verifyTurnstile(formData, clientIpFromHeaders(headerStore)))) return stepError(TURNSTILE_ERROR_MESSAGE, values);

  if (!devAuto && !(await signupAllowed(headerStore, email))) return stepError(PREAPERTURA_TOO_MANY_ATTEMPTS, values);

  const result = await createStudentAccount(admin, {
    email,
    password,
    birthDate: birth.birthDate,
    age: birth.age,
    isMinor: birth.isMinor,
    invitation,
    ip: clientIpOf(headerStore),
    userAgent: headerStore.get("user-agent"),
    attribution: await readAttribution(),
  });
  if (!result.ok) {
    if (result.reason === "email_exists") {
      return stepError("Ya hay una cuenta con ese email.", values, invitation ? undefined : "email", "email_exists");
    }
    return stepError(result.reason === "unavailable" ? UNAVAILABLE : GENERIC, values);
  }

  // Sesión iniciada: el cliente sigue a «Mi lugar» (DR67). Si el inicio de sesión fallara, la cuenta ya existe: se va a ingresar.
  const supabase = await getSupabaseServer();
  const signedIn = supabase ? await supabase.auth.signInWithPassword({ email, password }) : null;
  return {
    status: "success",
    redirectTo: signedIn && !signedIn.error ? "/mi-lugar" : "/login",
    ...(devAuto ? { devEmail: email } : {}),
  };
}

/** Aparecer o retirarse de la comunidad pública es un consentimiento: queda registrado cada vez que cambia (DR44.2). */
async function recordCommunityConsent(admin: SupabaseClient, userId: string, granted: boolean): Promise<void> {
  const headerStore = await headers();
  await admin.from("consents").insert({
    user_id: userId,
    consent_type: "preapertura_community",
    version: PREAPERTURA_CONSENT_VERSION,
    user_agent: headerStore.get("user-agent"),
    metadata: { granted, source: "preapertura_paso2" },
  });
  await createAuditLog(admin, {
    actorUserId: userId,
    actorRole: "student",
    action: granted ? "preapertura_community_enabled" : "preapertura_community_disabled",
    entityType: "users",
    entityId: userId,
  });
}

/**
 * El carrusel público muestra lo que se guardó recién: si alguien destilda la comunidad (o cambia sus datos), tiene que verse al
 * instante. La etiqueta invalida la caché de datos del carrusel; las rutas, las páginas ya generadas que lo incluyen (`/` y
 * `/for-students` son reescrituras de `/preapertura`).
 */
function refreshCommunityRail(): void {
  revalidateTag(COMMUNITY_RAIL_TAG);
  for (const path of ["/preapertura", "/", "/for-students"]) revalidatePath(path);
}

const PROFILE_SAVE_ERROR = "No pudimos guardar tu perfil. Probá de nuevo. Lo que completaste sigue acá.";

/**
 * Perfil (obligatorio desde DR67): guarda el del estudiante logueado. El `user_id` sale SIEMPRE de la sesión (`getSafeUser`), nunca del
 * formulario; solo escribe la fila propia con service role. La edad (y por lo tanto si puede activar la comunidad) sale de la fecha
 * de nacimiento guardada. Listas cerradas y longitudes se validan en `validateProfile`.
 */
export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  if (!isPreaperturaOn()) return { status: "error", message: UNAVAILABLE };
  const supabase = await getSupabaseServer();
  const user = supabase ? await getSafeUser(supabase) : null;
  if (!user) return { status: "error", code: "no_session", message: "Tu sesión venció. Ingresá de nuevo para guardar tu perfil." };
  if (!(await profileSaveAllowed(user.id))) return { status: "error", message: PREAPERTURA_TOO_MANY_ATTEMPTS };

  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: UNAVAILABLE };

  const { data: row, error: readError } = await admin
    .from("preapertura_estudiantes")
    .select("role, birth_date, consent_comunidad")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError || !row) return { status: "error", message: "No pudimos encontrar tu registro. Probá de nuevo en unos minutos." };
  // El paso 2 es del estudiante: un familiar no tiene perfil de búsqueda.
  if ((row as { role: string }).role !== "student") return { status: "error", message: "Este paso es solo para estudiantes." };

  // El retiro de la comunidad nunca se bloquea (DR44, Ley 25.326): se guarda antes de validar el resto del perfil.
  const before = Boolean((row as { consent_comunidad: boolean }).consent_comunidad);
  const withdrawing = before && formData.get("community") !== "on";
  if (withdrawing) {
    const { error } = await admin.from("preapertura_estudiantes").update({ consent_comunidad: false }).eq("user_id", user.id);
    if (error) {
      console.error("[preapertura] community withdrawal failed:", error.code);
      return { status: "error", message: PROFILE_SAVE_ERROR };
    }
    await recordCommunityConsent(admin, user.id, false);
    refreshCommunityRail();
  }

  const isMinor = isMinorByBirthDate((row as { birth_date: string | null }).birth_date);
  const result = validateProfile(
    {
      first_name: formData.get("first_name"),
      country: formData.get("country"),
      province: formData.get("province"),
      university: formData.get("university"),
      career: formData.get("career"),
      career_other: formData.get("career_other"),
      entry: formData.get("entry"),
      room_type: formData.get("room_type"),
      habits: formData.getAll("habits"),
      interests: formData.getAll("interests"),
      in_residence: formData.get("in_residence"),
      current_residence: formData.get("current_residence"),
      community: formData.get("community"),
    },
    { isMinor },
  );
  if (!result.ok) {
    return { status: "error", message: result.message, fieldErrors: result.fieldErrors, ...(withdrawing ? { communityRemoved: true } : {}) };
  }
  const v = result.value;

  const { error: updateError } = await admin
    .from("preapertura_estudiantes")
    .update({
      first_name: v.firstName,
      country: v.country,
      province: v.province,
      university: v.university,
      career: v.career,
      entry_month: v.entryMonth,
      entry_year: v.entryYear,
      entry_unsure: v.entryUnsure,
      room_type: v.roomType,
      habits: v.habits,
      interests: v.interests,
      current_residence: v.currentResidence,
      consent_comunidad: v.consentComunidad,
    })
    .eq("user_id", user.id);
  if (updateError) {
    console.error("[preapertura] profile update failed:", updateError.code);
    return { status: "error", message: PROFILE_SAVE_ERROR };
  }

  // El nombre de pila también va al perfil de estudiante (la columna es obligatoria y hoy está vacía). Mejor esfuerzo.
  if (v.firstName) {
    await admin.from("student_profiles").update({ first_name: v.firstName }).eq("user_id", user.id);
  }

  // El retiro ya quedó registrado arriba: acá solo falta el cambio en el otro sentido.
  if (!withdrawing && before !== v.consentComunidad) await recordCommunityConsent(admin, user.id, v.consentComunidad);
  refreshCommunityRail();

  return { status: "success", redirectTo: "/mi-lugar" };
}
