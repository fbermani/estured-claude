import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createFamilyAccount, createStudentAccount } from "@/lib/preapertura/accounts";
import { redeemInvitation, resolveInvitation } from "@/lib/preapertura/invitations";

/**
 * Integración contra `estured-dev` (patrón del repo). NECESITA la migración 0080 aplicada: si la tabla no existe, el bloque se
 * saltea con un aviso claro (no falla). Cada cuenta de prueba se borra al final (cascada por `users`).
 */
const admin: SupabaseClient | null = getSupabaseAdmin();
let ready = false;
const created: string[] = [];
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailOf = (tag: string) => `test-preap-${tag}-${stamp}@estured.test`;
const PASSWORD = `Tmp-${Math.random().toString(36).slice(2)}-Aa1!`;
const META = { ip: null, userAgent: "vitest" } as const;

beforeAll(async () => {
  if (!admin) return;
  const probe = await admin.from("preapertura_estudiantes").select("id").limit(1);
  const invites = await admin.from("preapertura_invitaciones").select("id").limit(1);
  ready = !probe.error && !invites.error;
  if (!ready) console.warn("[preapertura] accounts.test: migración 0080 sin aplicar en este entorno; las pruebas de integración se saltean.");
});

afterAll(async () => {
  if (!admin) return;
  // En orden inverso: el vínculo familiar referencia al familiar (sin cascada), así que primero se borra al estudiante.
  for (const id of [...created].reverse()) await admin.auth.admin.deleteUser(id).catch(() => {});
});

describe("alta de cuentas de preapertura (requiere 0080)", () => {
  it("estudiante adulto: cuenta real, fila de preapertura, consentimientos y comunidad sin tildar", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const result = await createStudentAccount(admin, { email: emailOf("adulto"), password: PASSWORD, birthDate: "2000-01-01", age: 26, isMinor: false, invitation: null, ...META });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    created.push(result.userId);
    const { data: row } = await admin.from("preapertura_estudiantes").select("role, consent_c, consent_comunidad, invited_by_user_id").eq("user_id", result.userId).single();
    expect(row).toMatchObject({ role: "student", consent_c: true, consent_comunidad: false, invited_by_user_id: null });
    const { data: consents } = await admin.from("consents").select("consent_type").eq("user_id", result.userId);
    expect((consents ?? []).map((c) => c.consent_type).sort()).toEqual(["privacy", "search_visibility_to_verified_residences", "terms"]);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", result.userId);
    expect(roles).toEqual([{ role: "student" }]);
  });

  it("el mismo email dos veces: email_exists y no queda nada a medias", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const email = emailOf("dup");
    const first = await createStudentAccount(admin, { email, password: PASSWORD, birthDate: "2000-01-01", age: 26, isMinor: false, invitation: null, ...META });
    if (first.ok) created.push(first.userId);
    const second = await createStudentAccount(admin, { email, password: PASSWORD, birthDate: "2000-01-01", age: 26, isMinor: false, invitation: null, ...META });
    expect(second).toEqual({ ok: false, reason: "email_exists" });
  });

  it("familiar + invitación + menor invitado: vínculo pendiente, invitación de un solo uso", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const kidEmail = emailOf("hijo");
    const family = await createFamilyAccount(admin, { email: emailOf("familiar"), password: PASSWORD, inviteeEmail: kidEmail, ...META });
    expect(family.ok).toBe(true);
    if (!family.ok) return;
    created.push(family.userId);

    const resolved = await resolveInvitation(admin, family.inviteToken);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.invitation.email).toBe(kidEmail);

    const kid = await createStudentAccount(admin, { email: kidEmail, password: PASSWORD, birthDate: "2010-05-02", age: 16, isMinor: true, invitation: resolved.invitation, ...META });
    expect(kid.ok).toBe(true);
    if (!kid.ok) return;
    created.push(kid.userId);

    const { data: link } = await admin
      .from("family_links")
      .select("status, requested_by_user_id")
      .eq("requested_by_user_id", family.userId)
      .single();
    expect(link).toMatchObject({ status: "pending_student_approval", requested_by_user_id: family.userId });
    const { data: pre } = await admin.from("preapertura_estudiantes").select("invited_by_user_id, consent_comunidad, consent_c").eq("user_id", kid.userId).single();
    // Un menor invitado NO da la opción C ni la comunidad: ni el flag ni el registro del consentimiento de visibilidad a residencias.
    expect(pre).toMatchObject({ invited_by_user_id: family.userId, consent_comunidad: false, consent_c: false });
    const { data: kidConsents } = await admin.from("consents").select("consent_type").eq("user_id", kid.userId);
    expect((kidConsents ?? []).map((c) => c.consent_type).sort()).toEqual(["privacy", "terms"]);

    // Ya canjeada: ni se resuelve ni se canjea de nuevo.
    expect(await resolveInvitation(admin, family.inviteToken)).toEqual({ ok: false, reason: "used" });
    expect(await redeemInvitation(admin, resolved.invitation.id, kid.userId)).toBe(false);
  });

  it("una sola invitación por familiar: un segundo alta de familiar con el mismo email no crea otra", async (ctx) => {
    if (!admin || !ready) return ctx.skip();
    const email = emailOf("familiar2");
    const first = await createFamilyAccount(admin, { email, password: PASSWORD, inviteeEmail: emailOf("hijo2"), ...META });
    if (first.ok) created.push(first.userId);
    const again = await createFamilyAccount(admin, { email, password: PASSWORD, inviteeEmail: emailOf("hijo3"), ...META });
    expect(again).toEqual({ ok: false, reason: "email_exists" });
  });
});
