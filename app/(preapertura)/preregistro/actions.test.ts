import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Acciones de la preapertura (integración contra `estured-dev`, requiere 0080): invitación familiar sin token en la respuesta,
 * mayoría de edad del familiar, sin mail no hay invitación, y el menor invitado nunca persiste la comunidad. Los mails, la sesión y
 * el flag se simulan: nunca sale un mail real. Las cuentas de prueba (`test-pract-*@estured.test`) se borran al final.
 */
const sent: Array<{ to: string; subject: string; html: string }> = [];
let clientIp = "203.0.113.1";
let mailOk = true;
let providerOn = true;
let sessionUserId: string | null = null;

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": clientIp }) }));
vi.mock("next/cache", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/cache")>()), revalidateTag: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/preapertura/flag", () => ({ isPreaperturaOn: () => true }));
vi.mock("@/lib/security/turnstile", () => ({ TURNSTILE_ERROR_MESSAGE: "captcha", verifyTurnstile: async () => true }));
// Rate limit persistente (0083) simulado: el test no deja filas en `rate_limit_hits` ni depende de corridas anteriores.
vi.mock("@/lib/security/rateLimit", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/security/rateLimit")>()), consumeRateLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({ auth: { signInWithPassword: async () => ({ error: null }) } }) }));
vi.mock("@/lib/supabase/safe-get-user", () => ({ getSafeUser: async () => (sessionUserId ? { id: sessionUserId } : null) }));
vi.mock("@/lib/email/sendEmail", () => ({
  isEmailProviderConfigured: () => providerOn,
  sendEmail: async (entry: { to: string; subject: string; html: string }) => {
    sent.push(entry);
    return mailOk;
  },
}));

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStudentAccount } from "@/lib/preapertura/accounts";
import { hashInviteToken } from "@/lib/preapertura/invitations";
import { registerStudentStep1, saveProfile } from "@/app/(preapertura)/preregistro/actions";
import { registerFamilyInvite } from "@/app/(preapertura)/preregistro/familiar/actions";
import type { FamilyState, Step1State } from "@/lib/preapertura/formState";

const admin = getSupabaseAdmin();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailOf = (tag: string) => `test-pract-${tag}-${stamp}@estured.test`;
const PASSWORD = `Tmp-${Math.random().toString(36).slice(2)}-Aa1!`;
const IDLE: FamilyState = { status: "idle" };
const known: string[] = [];

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of Array.isArray(v) ? v : [v]) data.append(k, item);
  return data;
}
const familyFields = (tag: string, extra: Record<string, string> = {}) => ({
  email: emailOf(`fam-${tag}`),
  student_email: emailOf(`hijo-${tag}`),
  password: PASSWORD,
  accept_adult: "on",
  accept_terms: "on",
  ...extra,
});
async function userIdByEmail(email: string): Promise<string | null> {
  const { data } = await admin!.from("users").select("id").eq("email", email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

let ready = false;
beforeAll(async () => {
  if (!admin) return;
  const probe = await admin.from("preapertura_invitaciones").select("id").limit(1);
  ready = !probe.error;
  if (!ready) console.warn("[preapertura] actions.test: migración 0080 sin aplicar; la integración se saltea.");
});
beforeEach(() => {
  sent.length = 0;
  mailOk = true;
  providerOn = true;
  sessionUserId = null;
  clientIp = `203.0.113.${Math.floor(Math.random() * 250) + 2}`;
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  if (!admin) return;
  for (const email of known) {
    const id = await userIdByEmail(email);
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  // Los familiares primero referencian a sus hijos por el vínculo; si quedó alguno suelto, se barre por prefijo.
  const { data } = await admin.from("users").select("id, email").like("email", `test-pract-%-${stamp}@estured.test`);
  for (const u of (data ?? []) as { id: string }[]) await admin.auth.admin.deleteUser(u.id).catch(() => {});
});

describe("registerFamilyInvite: la invitación sale solo por mail", () => {
  it("sin declarar «Soy mayor de 18 años» no se crea nada (validado en el servidor)", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const fields = familyFields("noadult");
    delete (fields as Record<string, string | undefined>).accept_adult;
    const state = await registerFamilyInvite(IDLE, form(fields));
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("accept_adult");
    expect(await userIdByEmail(fields.email)).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("producción sin proveedor de mail: error claro y no se emite invitación ni se crea la cuenta", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    providerOn = false;
    const fields = familyFields("nomail");
    const state = await registerFamilyInvite(IDLE, form(fields));
    expect(state.status).toBe("error");
    expect(state.message).toContain("No pudimos enviar la invitación, probá más tarde");
    expect(state).not.toHaveProperty("invitePath");
    expect(await userIdByEmail(fields.email)).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("producción con mail: la respuesta NO trae el token ni el link; el mail sale solo al invitado con ese token", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const fields = familyFields("ok");
    known.push(fields.email, fields.student_email);
    const state = await registerFamilyInvite(IDLE, form(fields));
    expect(state.status).toBe("success");
    expect(state).not.toHaveProperty("invitePath");
    expect(JSON.stringify(state)).not.toMatch(/invitacion|token/i);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(fields.student_email);
    const token = /invitacion=([A-Za-z0-9_-]+)/.exec(sent[0].html)?.[1];
    expect(token).toBeTruthy();
    // El hash guardado corresponde al token que viajó por mail (y a ningún otro dato de la respuesta).
    const familyId = await userIdByEmail(fields.email);
    const { data: inv } = await admin.from("preapertura_invitaciones").select("token_hash, invitee_email").eq("inviter_user_id", familyId!).single();
    expect(inv).toMatchObject({ token_hash: hashInviteToken(token!), invitee_email: fields.student_email });
    expect(createHash("sha256").update(token!).digest("hex")).toBe(hashInviteToken(token!));
  });

  it("producción y el mail falla: se deshace el alta (sin cuenta ni invitación) para poder reintentar", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    mailOk = false;
    const fields = familyFields("fallo");
    known.push(fields.email);
    const state = await registerFamilyInvite(IDLE, form(fields));
    expect(state.status).toBe("error");
    expect(state.message).toContain("No pudimos enviar la invitación");
    expect(await userIdByEmail(fields.email)).toBeNull();
    const { data: inv } = await admin.from("preapertura_invitaciones").select("id").eq("invitee_email", fields.student_email);
    expect(inv ?? []).toHaveLength(0);
  });

  it("solo en desarrollo se devuelve el link para probar", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    vi.stubEnv("NODE_ENV", "development");
    providerOn = false;
    mailOk = false;
    const fields = familyFields("dev");
    known.push(fields.email, fields.student_email);
    const state = await registerFamilyInvite(IDLE, form(fields));
    expect(state.status).toBe("success");
    expect(state.invitePath).toMatch(/^\/preregistro\?invitacion=/);
  });
});

describe("saveProfile: un menor invitado nunca persiste la comunidad", () => {
  const profile = (community: boolean) => ({
    first_name: "Prueba",
    country: "Chile",
    university: "UBA",
    career: "Derecho",
    entry: "3",
    room_type: "any",
    habits: ["Madrugo", "No fumo"],
    interests: ["Cine", "Lectura"],
    ...(community ? { community: "on" } : {}),
  });
  const META = { ip: null, userAgent: "vitest" } as const;

  it("menor (por fecha de nacimiento guardada): tildar la comunidad se ignora y queda en false", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const email = emailOf("menor");
    known.push(email);
    const kid = await createStudentAccount(admin, { email, password: PASSWORD, birthDate: "2010-05-02", age: 16, isMinor: true, invitation: null, ...META });
    expect(kid.ok).toBe(true);
    if (!kid.ok) return;
    sessionUserId = kid.userId;
    const state = await saveProfile({ status: "idle" }, form(profile(true)));
    expect(state.status).toBe("success");
    const { data } = await admin.from("preapertura_estudiantes").select("consent_comunidad, first_name").eq("user_id", kid.userId).single();
    expect(data).toMatchObject({ consent_comunidad: false, first_name: "Prueba" });
    const { data: consents } = await admin.from("consents").select("consent_type").eq("user_id", kid.userId).eq("consent_type", "preapertura_community");
    expect(consents ?? []).toHaveLength(0);
  });

  it("de control: un adulto sí puede activarla", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const email = emailOf("adulto");
    known.push(email);
    const adult = await createStudentAccount(admin, { email, password: PASSWORD, birthDate: "2000-05-02", age: 26, isMinor: false, invitation: null, ...META });
    expect(adult.ok).toBe(true);
    if (!adult.ok) return;
    sessionUserId = adult.userId;
    expect((await saveProfile({ status: "idle" }, form(profile(true)))).status).toBe("success");
    const { data } = await admin.from("preapertura_estudiantes").select("consent_comunidad").eq("user_id", adult.userId).single();
    expect(data).toMatchObject({ consent_comunidad: true });
  });
});

describe("saveProfile: el retiro de la comunidad nunca se bloquea (DR44, Ley 25.326)", () => {
  const META = { ip: null, userAgent: "vitest" } as const;

  /** Estudiante adulto con la comunidad activa y el perfil vacío. */
  async function publicStudent(tag: string): Promise<string> {
    const email = emailOf(tag);
    known.push(email);
    const created = await createStudentAccount(admin!, { email, password: PASSWORD, birthDate: "2000-05-02", age: 26, isMinor: false, invitation: null, ...META });
    if (!created.ok) throw new Error(`No se pudo crear la cuenta de prueba: ${created.reason}`);
    await admin!.from("preapertura_estudiantes").update({ consent_comunidad: true }).eq("user_id", created.userId);
    sessionUserId = created.userId;
    return created.userId;
  }
  async function communityConsentOf(userId: string): Promise<boolean> {
    const { data } = await admin!.from("preapertura_estudiantes").select("consent_comunidad").eq("user_id", userId).single();
    return (data as { consent_comunidad: boolean }).consent_comunidad;
  }
  async function consentRecords(userId: string) {
    const { data } = await admin!.from("consents").select("metadata").eq("user_id", userId).eq("consent_type", "preapertura_community");
    return (data ?? []) as { metadata: { granted: boolean } }[];
  }

  it("retirar la comunidad se guarda aunque falten obligatorios, con su registro", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const userId = await publicStudent("retiro");
    const state = await saveProfile({ status: "idle" }, form({ first_name: "Lu" })); // sin `community`
    expect(state.status).toBe("error");
    expect(state).toHaveProperty("fieldErrors.university");
    expect(await communityConsentOf(userId)).toBe(false);
    expect((await consentRecords(userId)).map((c) => c.metadata.granted)).toEqual([false]);
    const { data: audit } = await admin.from("audit_logs").select("id").eq("actor_user_id", userId).eq("action", "preapertura_community_disabled");
    expect(audit).toHaveLength(1);
  });

  it("con la casilla tildada y datos faltantes no cambia nada", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const userId = await publicStudent("sigue");
    const state = await saveProfile({ status: "idle" }, form({ first_name: "Lu", community: "on" }));
    expect(state.status).toBe("error");
    expect(await communityConsentOf(userId)).toBe(true);
    expect(await consentRecords(userId)).toHaveLength(0);
  });

  it("retirar con el perfil completo registra una sola vez", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const userId = await publicStudent("retiro-completo");
    const state = await saveProfile(
      { status: "idle" },
      form({ first_name: "Lu", country: "Chile", university: "UBA", career: "Derecho", entry: "3", room_type: "any" }),
    );
    expect(state.status).toBe("success");
    expect(await communityConsentOf(userId)).toBe(false);
    expect(await consentRecords(userId)).toHaveLength(1);
  });
});

describe("número de registro (DR67, migración 0111)", () => {
  const META = { ip: null, userAgent: "vitest" } as const;

  it("un alta de estudiante queda con número desde 11; un familiar, sin número", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const email = emailOf("numero");
    known.push(email);
    const kid = await createStudentAccount(admin, { email, password: PASSWORD, birthDate: "2000-05-02", age: 26, isMinor: false, invitation: null, ...META });
    expect(kid.ok).toBe(true);
    if (!kid.ok) return;
    const { data } = await admin.from("preapertura_estudiantes").select("registration_number").eq("user_id", kid.userId).single();
    expect((data as { registration_number: number }).registration_number).toBeGreaterThanOrEqual(11);

    const family = familyFields("numero");
    known.push(family.email, family.student_email);
    expect((await registerFamilyInvite(IDLE, form(family))).status).toBe("success");
    const familyId = await userIdByEmail(family.email);
    const { data: row } = await admin.from("preapertura_estudiantes").select("registration_number").eq("user_id", familyId!).single();
    expect(row).toEqual({ registration_number: null });
  });
});

describe("envío vacío: cuenta de prueba SOLO en desarrollo", () => {
  const EMPTY_STEP1 = { email: "", password: "", birth_date: "" };
  const EMPTY_FAMILY = { email: "", student_email: "", password: "" };
  const STEP1: Step1State = { status: "idle" };

  it("PRODUCCIÓN: el paso 1 vacío falla con la validación normal y no crea ninguna cuenta", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const countBefore = (await admin.from("users").select("id", { count: "exact", head: true }).like("email", "test-preap-est-%")).count;
    const state = await registerStudentStep1(STEP1, form(EMPTY_STEP1));
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(state).not.toHaveProperty("devEmail");
    const countAfter = (await admin.from("users").select("id", { count: "exact", head: true }).like("email", "test-preap-est-%")).count;
    expect(countAfter).toBe(countBefore); // ninguna cuenta autogenerada nueva
  });

  it("PRODUCCIÓN: el registro familiar vacío falla con la validación normal y no crea nada", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const countBefore = (await admin.from("users").select("id", { count: "exact", head: true }).like("email", "test-preap-fam-%")).count;
    const state = await registerFamilyInvite(IDLE, form(EMPTY_FAMILY));
    expect(state.status).toBe("error");
    expect(state).not.toHaveProperty("devEmail");
    expect(state).not.toHaveProperty("invitePath");
    const countAfter = (await admin.from("users").select("id", { count: "exact", head: true }).like("email", "test-preap-fam-%")).count;
    expect(countAfter).toBe(countBefore);
    expect(sent).toHaveLength(0);
  });

  it("también fuera de desarrollo (entorno de test): vacío nunca autogenera", async () => {
    vi.stubEnv("NODE_ENV", "test");
    expect((await registerStudentStep1(STEP1, form(EMPTY_STEP1))).status).toBe("error");
    expect((await registerFamilyInvite(IDLE, form(EMPTY_FAMILY))).status).toBe("error");
  });

  it("DESARROLLO: el paso 1 vacío crea una cuenta de prueba identificable (18+, con sesión) y sigue a «Mi lugar»", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    vi.stubEnv("NODE_ENV", "development");
    const state = await registerStudentStep1(STEP1, form(EMPTY_STEP1));
    expect(state.status).toBe("success");
    expect(state.redirectTo).toBe("/mi-lugar");
    expect(state.devEmail).toMatch(/^test-preap-est-[0-9a-f]{8}@estured\.test$/);
    known.push(state.devEmail!);
    const id = await userIdByEmail(state.devEmail!);
    const { data } = await admin.from("preapertura_estudiantes").select("role, consent_c, birth_date").eq("user_id", id!).single();
    expect(data).toMatchObject({ role: "student", consent_c: true, birth_date: "2000-01-15" });
    expect(JSON.stringify(state)).not.toMatch(/password|Dev-/);
  });

  it("DESARROLLO: con cualquier campo escrito la validación normal sigue intacta (no se autogenera)", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    vi.stubEnv("NODE_ENV", "development");
    const state = await registerStudentStep1(STEP1, form({ email: "no-es-un-mail", password: "", birth_date: "" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("email");
    const family = await registerFamilyInvite(IDLE, form({ email: "", student_email: "", password: "solo-esto" }));
    expect(family.status).toBe("error");
  });

  it("DESARROLLO: el registro familiar vacío crea familiar + invitación de prueba y muestra el link, sin mandar mail", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    vi.stubEnv("NODE_ENV", "development");
    const state = await registerFamilyInvite(IDLE, form(EMPTY_FAMILY));
    expect(state.status).toBe("success");
    expect(state.devEmail).toMatch(/^test-preap-fam-[0-9a-f]{8}@estured\.test$/);
    expect(state.invitePath).toMatch(/^\/preregistro\?invitacion=/);
    known.push(state.devEmail!);
    expect(sent).toHaveLength(0);
    const familyId = await userIdByEmail(state.devEmail!);
    const { data: inv } = await admin.from("preapertura_invitaciones").select("invitee_email").eq("inviter_user_id", familyId!).single();
    expect(inv?.invitee_email).toMatch(/^test-preap-hijo-[0-9a-f]{8}@estured\.test$/);
  });
});
