/**
 * Auditoría complementaria 2026-11-15 — sesiones no cubiertas en la primera pasada (apartado A): menor y su tutor, familiar con
 * vínculo activo / pendiente / revocado / suspendido / sin vínculo, admin y superadmin. Sesiones REALES (JWT + clave anónima).
 *
 * Ejecutar: npx vitest run docs/audits/evidence/2026-11-15/seguridad-sesiones.test.ts
 *
 * Fixtures aislados (`audit-ses-*@estured.test`, slug `residencia-test-audit-ses-*`), borrados en `afterAll`. Solo corre contra dev.
 * Lo que mide: cada actor lee solo lo que le corresponde, el admin NO lee datos ajenos con su JWT (el panel usa service role en el
 * servidor), y ninguna sesión puede escribir directo (tras la 0090 ni siquiera tiene el permiso de tabla).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const hasCreds = Boolean(URL_ && ANON && SERVICE);
const DEV_REF = "gyfbtsuibmecefwovdgh";
const PASSWORD = `Aud-${Math.random().toString(36).slice(2)}-Zz9!`;
const TAG = `audit-ses-${Date.now()}`;

type Rec = { id: string; control: string; expected: string; got: string; status: "comprobado" | "fallido" };
const evidence: Rec[] = [];
function rec(id: string, control: string, expected: string, got: string, ok: boolean) {
  evidence.push({ id, control, expected, got, status: ok ? "comprobado" : "fallido" });
}

describe.skipIf(!hasCreds)("sesiones: menor, familiares, admin, superadmin (dev, fixtures aislados)", () => {
  let admin: SupabaseClient;
  const authUsers: string[] = [];
  const emails: Record<string, string> = {};
  const familyMemberIds: string[] = [];
  const linkIds: string[] = [];
  let adult: TestStudent, minor: TestStudent, other: TestStudent;
  let residenceId = "";
  let appAdult = "";
  let appMinor = "";
  const sessions: Record<string, SupabaseClient> = {};
  const ids: Record<string, string> = {};

  async function mkUser(role: string, label: string): Promise<string> {
    const email = `${TAG}-${label}@estured.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`mkUser ${label}: ${error?.message}`);
    authUsers.push(data.user.id);
    emails[label] = email;
    ids[label] = data.user.id;
    await admin.from("users").insert({ id: data.user.id, email, phone: "+54 11 5555-0000", primary_role: role });
    await admin.from("user_roles").insert({ user_id: data.user.id, role, scope_type: "global" });
    return data.user.id;
  }
  async function login(email: string): Promise<SupabaseClient> {
    const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`login: ${error.message}`);
    return c;
  }
  async function mkFamily(label: string, studentProfileId: string | null, status: string | null) {
    const userId = await mkUser("family_member", label);
    const { data: fm, error } = await admin
      .from("family_members")
      .insert({ user_id: userId, first_name: "Audit", last_name: "Familiar", relationship_type: "madre" })
      .select("id")
      .single();
    if (error || !fm) throw new Error(`family_member ${label}: ${error?.message}`);
    familyMemberIds.push(fm.id as string);
    if (studentProfileId && status) {
      const { data: link, error: linkError } = await admin
        .from("family_links")
        .insert({ student_profile_id: studentProfileId, family_member_id: fm.id, status, requested_by_user_id: userId, permissions: {} })
        .select("id")
        .single();
      if (linkError || !link) throw new Error(`family_link ${label}: ${linkError?.message}`);
      linkIds.push(link.id as string);
    }
  }
  async function mkApp(profileId: string, userId: string, rtId: string, snapId: string) {
    const { data, error } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: profileId,
        initiated_by: "student",
        contact_target: "student",
        residence_id: residenceId,
        room_type_id: rtId,
        status: "submitted",
        desired_start_date: "2027-03-01",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_original_id: snapId,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`app: ${error?.message}`);
    return data.id as string;
  }

  beforeAll(async () => {
    if (!URL_.includes(DEV_REF)) throw new Error("Este test solo corre contra estured-dev");
    admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    try {
      adult = await createTestStudent(admin, "ses-adult");
      minor = await createTestStudent(admin, "ses-minor");
      other = await createTestStudent(admin, "ses-other");
      await admin.from("student_profiles").update({ is_minor: true, birth_date: "2010-06-01", display_age: 16 }).eq("id", minor.profileId);
      // Los estudiantes de `createTestStudent` tienen contraseña aleatoria propia: se fija una conocida para el test.
      for (const s of [adult, minor, other]) await admin.auth.admin.updateUserById(s.userId, { password: PASSWORD });

      const ownerId = await mkUser("residence_owner", "owner");
      await mkUser("admin", "admin");
      await mkUser("superadmin", "superadmin");

      const { data: residence, error: rError } = await admin
        .from("residences")
        .insert({
          name: "Residencia Test Integración (auditoría sesiones)",
          slug: `residencia-test-${TAG}`,
          property_type: "residencia_estudiantil",
          status: "verified_active",
          operating_mode: "verified_profile",
          public_area: "Palermo",
          total_capacity: 5,
          created_by: ownerId,
        })
        .select("id")
        .single();
      if (rError || !residence) throw new Error(`residencia: ${rError?.message}`);
      residenceId = residence.id as string;
      await admin.from("residence_users").insert({ residence_id: residenceId, user_id: ownerId, role: "owner", is_active: true });
      const { data: rt } = await admin.from("room_types").insert({ residence_id: residenceId, name: "Individual", monthly_price_usd: 300, monthly_price_ars: 456000 }).select("id").single();
      const { data: snap } = await admin
        .from("application_snapshots")
        .insert({
          snapshot_type: "original",
          residence_id: residenceId,
          room_type_id: rt!.id,
          monthly_price_usd: 300,
          monthly_price_ars: 456000,
          exchange_rate_ars_per_usd: 1520,
          exchange_rate_source: "test",
          exchange_rate_date: new Date().toISOString().slice(0, 10),
          initial_duration_months: 6,
          adjustment_policy: "quarterly",
          deposit_excluded_from_fee: true,
        })
        .select("id")
        .single();
      appAdult = await mkApp(adult.profileId, adult.userId, rt!.id as string, snap!.id as string);
      appMinor = await mkApp(minor.profileId, minor.userId, rt!.id as string, snap!.id as string);

      // Familiares del adulto: activo, pendiente, revocado por el estudiante, revocado por la familia, sin vínculo.
      await mkFamily("f-activo", adult.profileId, "active");
      await mkFamily("f-pendiente", adult.profileId, "pending_student_approval");
      await mkFamily("f-revocado", adult.profileId, "revoked_by_student");
      await mkFamily("f-revocado-fam", adult.profileId, "revoked_by_family");
      await mkFamily("f-sin-vinculo", null, null);
      // Tutores del menor: activo y suspendido por «menor sin familia».
      await mkFamily("t-activo", minor.profileId, "active");
      await mkFamily("t-suspendido", minor.profileId, "suspended_minor_no_family");

      const logins: Record<string, string> = {
        adult: adult.email,
        minor: minor.email,
        other: other.email,
        admin: emails.admin,
        superadmin: emails.superadmin,
        owner: emails.owner,
        "f-activo": emails["f-activo"],
        "f-pendiente": emails["f-pendiente"],
        "f-revocado": emails["f-revocado"],
        "f-revocado-fam": emails["f-revocado-fam"],
        "f-sin-vinculo": emails["f-sin-vinculo"],
        "t-activo": emails["t-activo"],
        "t-suspendido": emails["t-suspendido"],
      };
      for (const [k, e] of Object.entries(logins)) sessions[k] = await login(e);
      sessions.anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    } catch (e) {
      await cleanup();
      throw e;
    }
  }, 240_000);

  async function cleanup() {
    if (!admin) return;
    for (const id of linkIds) await admin.from("family_links").delete().eq("id", id);
    for (const id of familyMemberIds) await admin.from("family_members").delete().eq("id", id);
    if (residenceId) await deleteResidenceCascade(admin, residenceId);
    for (const s of [adult, minor, other]) await deleteTestStudent(admin, s);
    for (const id of authUsers) {
      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("users").delete().eq("id", id);
      await admin.auth.admin.deleteUser(id);
    }
  }

  afterAll(async () => {
    await cleanup();
    const out = resolve(__dirname, "results-sesiones.json");
    writeFileSync(out, JSON.stringify({ tag: TAG, generated: new Date().toISOString(), evidence }, null, 2));
  }, 240_000);

  async function seesProfile(actor: string, profileId: string) {
    const { data } = await sessions[actor].from("student_profiles").select("id").eq("id", profileId);
    return (data ?? []).length;
  }
  async function seesApp(actor: string, appId: string) {
    const { data } = await sessions[actor].from("application_requests").select("id").eq("id", appId);
    return (data ?? []).length;
  }

  it("lecturas: cada sesión ve solo lo suyo (adulto, menor, familiares, admin, superadmin)", async () => {
    // [actor, perfil, solicitud, esperado visible]
    const cases: [string, string, string, boolean][] = [
      ["adult", adult.profileId, appAdult, true],
      ["f-activo", adult.profileId, appAdult, true],
      ["f-pendiente", adult.profileId, appAdult, false],
      ["f-revocado", adult.profileId, appAdult, false],
      ["f-revocado-fam", adult.profileId, appAdult, false],
      ["f-sin-vinculo", adult.profileId, appAdult, false],
      ["other", adult.profileId, appAdult, false],
      ["admin", adult.profileId, appAdult, false],
      ["superadmin", adult.profileId, appAdult, false],
      ["anon", adult.profileId, appAdult, false],
      ["minor", minor.profileId, appMinor, true],
      ["t-activo", minor.profileId, appMinor, true],
      ["t-suspendido", minor.profileId, appMinor, false],
      ["adult", minor.profileId, appMinor, false],
      ["f-activo", minor.profileId, appMinor, false],
      ["admin", minor.profileId, appMinor, false],
      ["superadmin", minor.profileId, appMinor, false],
      ["minor", adult.profileId, appAdult, false],
      ["t-activo", adult.profileId, appAdult, false],
    ];
    for (const [actor, profile, app, expected] of cases) {
      const p = await seesProfile(actor, profile);
      const a = await seesApp(actor, app);
      const label = profile === adult.profileId ? "adulto" : "menor";
      const ok = expected ? p === 1 && a === 1 : p === 0 && a === 0;
      rec(`S1:${actor}->${label}`, `${actor} lee perfil y solicitud del ${label}`, expected ? "ve ambos" : "no ve nada", `perfil=${p}, solicitud=${a}`, ok);
    }
    expect(evidence.filter((e) => e.id.startsWith("S1:") && e.status === "fallido")).toEqual([]);
  }, 180_000);

  it("admin y superadmin con JWT no leen datos privados ajenos (el panel usa service role en el servidor)", async () => {
    for (const actor of ["admin", "superadmin"]) {
      const tables = ["users", "student_profiles", "application_requests", "family_links", "family_members", "files", "audit_logs", "support_cases", "estured_fee_payments"];
      const seen: string[] = [];
      for (const t of tables) {
        const { data, error } = await sessions[actor].from(t).select("id").limit(50);
        const rows = error ? 0 : (data ?? []).length;
        // Se admite verse a sí mismo en `users`; cualquier otra fila ajena es falla.
        const own = t === "users" ? (data ?? []).filter((r) => (r as { id: string }).id === ids[actor]).length : 0;
        if (rows - own > 0) seen.push(`${t}:${rows - own}`);
      }
      rec(`S2:${actor}-lecturas`, `${actor} con su JWT lee tablas privadas`, "0 filas ajenas", seen.length ? seen.join(", ") : "0 filas ajenas", seen.length === 0);
      expect(seen).toEqual([]);
    }
  }, 120_000);

  it("escrituras directas con JWT: ninguna sesión escala privilegios ni modifica datos ajenos", async () => {
    const { data: before } = await admin.from("application_requests").select("status").eq("id", appAdult).single();
    const { data: linkBefore } = await admin.from("family_links").select("status, permissions").eq("id", linkIds[0]).single();
    const attempts: [string, () => PromiseLike<{ error: unknown }>][] = [
      ["f-activo:update-solicitud", () => sessions["f-activo"].from("application_requests").update({ status: "cancelled_by_student" }).eq("id", appAdult)],
      ["f-activo:update-vinculo", () => sessions["f-activo"].from("family_links").update({ permissions: { everything: true } }).eq("id", linkIds[0])],
      ["f-revocado:reactivar-vinculo", () => sessions["f-revocado"].from("family_links").update({ status: "active" }).eq("id", linkIds[2])],
      ["f-pendiente:aprobarse", () => sessions["f-pendiente"].from("family_links").update({ status: "active" }).eq("id", linkIds[1])],
      ["minor:desmarcar-menor", () => sessions.minor.from("student_profiles").update({ is_minor: false }).eq("id", minor.profileId)],
      ["adult:rol-admin", () => sessions.adult.from("users").update({ primary_role: "superadmin" }).eq("id", adult.userId)],
      ["adult:insertar-rol", () => sessions.adult.from("user_roles").insert({ user_id: adult.userId, role: "superadmin", scope_type: "global" })],
      ["other:update-solicitud", () => sessions.other.from("application_requests").update({ status: "rejected" }).eq("id", appAdult)],
      ["other:borrar-perfil", () => sessions.other.from("student_profiles").delete().eq("id", adult.profileId)],
      ["admin:update-solicitud", () => sessions.admin.from("application_requests").update({ status: "rejected" }).eq("id", appAdult)],
      ["superadmin:update-solicitud", () => sessions.superadmin.from("application_requests").update({ status: "rejected" }).eq("id", appAdult)],
      ["superadmin:insertar-auditoria", () => sessions.superadmin.from("audit_logs").insert({ action: "falso", entity_type: "x", source: "admin" })],
      ["anon:insertar-solicitud", () => sessions.anon.from("application_requests").insert({ student_profile_id: adult.profileId, residence_id: residenceId })],
    ];
    for (const [id, run] of attempts) {
      const { error } = await run();
      // Debe fallar (sin permiso de tabla) o, a lo sumo, no afectar filas; el estado real se verifica abajo con service role.
      rec(`S3:${id}`, `escritura directa ${id}`, "rechazada", error ? "rechazada" : "sin error (se verifica el estado)", true);
    }
    const { data: after } = await admin.from("application_requests").select("status").eq("id", appAdult).single();
    const { data: linkAfter } = await admin.from("family_links").select("status, permissions").eq("id", linkIds[0]).single();
    const { data: minorAfter } = await admin.from("student_profiles").select("is_minor").eq("id", minor.profileId).single();
    const { data: roleAfter } = await admin.from("users").select("primary_role").eq("id", adult.userId).single();
    const { data: rolesAfter } = await admin.from("user_roles").select("role").eq("user_id", adult.userId);
    const { data: statuses } = await admin.from("family_links").select("id, status").in("id", linkIds);
    const statusById = new Map((statuses ?? []).map((r) => [r.id as string, r.status as string]));
    const { data: fakeAudit } = await admin.from("audit_logs").select("id").eq("action", "falso").limit(1);
    const { data: profileStill } = await admin.from("student_profiles").select("id").eq("id", adult.profileId);
    const unchanged =
      after?.status === before?.status &&
      JSON.stringify(linkAfter) === JSON.stringify(linkBefore) &&
      minorAfter?.is_minor === true &&
      roleAfter?.primary_role === "student" &&
      (rolesAfter ?? []).length === 1 &&
      statusById.get(linkIds[1]) === "pending_student_approval" &&
      statusById.get(linkIds[2]) === "revoked_by_student" &&
      (fakeAudit ?? []).length === 0 &&
      (profileStill ?? []).length === 1;
    rec("S3:estado-final", "tras 13 escrituras directas el estado real no cambió", "sin cambios", unchanged ? "sin cambios" : "CAMBIÓ", unchanged);
    expect(unchanged).toBe(true);
  }, 120_000);
});
