import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createFamilyAccount, createStudentAccount } from "@/lib/preapertura/accounts";
import { resolveInvitation } from "@/lib/preapertura/invitations";
import { DEV_BIRTH_DATE, DEV_ACCOUNT_DOMAIN, DEV_ACCOUNT_PREFIX, devAutoAccountsEnabled } from "@/lib/preapertura/devAccounts";
import { DEV_SCREENS, DEV_STATES, type DevState } from "@/lib/preapertura/devScreens";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import { ageByBirthDate } from "@/lib/students/isMinorByBirthDate";

/**
 * SOLO DESARROLLO (404 en producción): deja la sesión que necesita una pantalla del flujo de preapertura y redirige. Lo usa el navegador
 * «Pantallas (dev)». Cuentas de prueba FIJAS (`test-preap-dev-…@estured.test`, se crean la primera vez y se reusan); `seed --borrar` las limpia.
 * `next` solo puede ser una de las rutas de `DEV_SCREENS` (nunca un destino arbitrario).
 */
const DEV_PASSWORD = "Preap-Dev-Pantallas-2026-Aa1!";
const emailOf = (tag: string) => `${DEV_ACCOUNT_PREFIX}dev-${tag}@${DEV_ACCOUNT_DOMAIN}`;
const META = { ip: null, userAgent: "dev-pantallas" } as const;

const FULL_PROFILE = {
  first_name: "Prueba", country: "Chile", province: null, university: "UBA", career: "Derecho", entry_month: 3, entry_year: new Date().getUTCFullYear() + 1,
  entry_unsure: false, room_type: "individual", habits: ["Madrugo", "No fumo"], interests: ["Cine", "Lectura"],
};

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

async function ensureStudent(admin: Admin, tag: string, full: boolean) {
  const created = await createStudentAccount(admin, {
    email: emailOf(tag), password: DEV_PASSWORD, birthDate: DEV_BIRTH_DATE, age: ageByBirthDate(DEV_BIRTH_DATE) ?? 26, isMinor: false, invitation: null, ...META,
  });
  if (created.ok && full) await admin.from("preapertura_estudiantes").update(FULL_PROFILE).eq("user_id", created.userId);
  return emailOf(tag);
}

async function ensureFamily(admin: Admin, tag: string, linked: boolean) {
  const kidEmail = emailOf(`hijo-${tag}`);
  const created = await createFamilyAccount(admin, { email: emailOf(`fam-${tag}`), password: DEV_PASSWORD, inviteeEmail: kidEmail, declaredAdult: true, ...META });
  if (created.ok && linked) {
    // Cuentas conectadas: el estudiante canjea la invitación (vínculo pendiente de aprobación), como en el flujo real.
    const resolved = await resolveInvitation(admin, created.inviteToken);
    if (resolved.ok) {
      await createStudentAccount(admin, { email: kidEmail, password: DEV_PASSWORD, birthDate: DEV_BIRTH_DATE, age: ageByBirthDate(DEV_BIRTH_DATE) ?? 26, isMinor: false, invitation: resolved.invitation, ...META });
    }
  }
  return emailOf(`fam-${tag}`);
}

export async function GET(request: Request) {
  if (!devAutoAccountsEnabled() || !isPreaperturaOn()) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const state = url.searchParams.get("estado") as DevState | null;
  const next = url.searchParams.get("next") ?? "";
  const screen = DEV_SCREENS.find((s) => s.path === next);
  if (!state || !(DEV_STATES as readonly string[]).includes(state) || !screen) return new Response("Pantalla o estado inválido", { status: 400 });

  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();
  if (!supabase || !admin) return new Response("Falta la configuración de Supabase", { status: 500 });

  await supabase.auth.signOut();
  if (state !== "anon") {
    const email =
      state === "completo" ? await ensureStudent(admin, "completo", true)
      : state === "incompleto" ? await ensureStudent(admin, "incompleto", false)
      : state === "fam-pend" ? await ensureFamily(admin, "pend", false)
      : await ensureFamily(admin, "vinc", true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD });
    if (error) return new Response(`No pude iniciar sesión con la cuenta de prueba (${error.message})`, { status: 500 });
  }
  return NextResponse.redirect(new URL(screen.path, url.origin));
}
