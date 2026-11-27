/**
 * Auditoría complementaria de seguridad (2026-11-15) — pruebas dinámicas contra `estured-dev` con fixtures aislados.
 *
 * Ejecutar (desde la raíz): npx vitest run docs/audits/evidence/2026-11-15/seguridad-complementaria.test.ts
 *
 * - Todos los usuarios, residencias, archivos y solicitudes se crean acá, con prefijo `audit-sec-` / slug `residencia-test-audit-sec-`,
 *   y se borran en `afterAll`. No toca usuarios demo compartidos.
 * - Las sondas de RLS/Storage/RPC usan SESIONES REALES (JWT del actor, clave anónima), no service role.
 * - La parte DR48 y la concurrencia llaman a los módulos reales con el cliente admin (así corre el servidor).
 * - El resultado sanitizado (sin tokens, sin URLs firmadas) se escribe en results.json.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { createTestStudent, deleteTestStudent, type TestStudent } from "@/lib/testing/testStudent";
import { grantResidenceDocumentAccess } from "@/lib/documents/residenceDocumentAccess";
import { recordResidencePaymentReceived } from "@/lib/reservations/recordResidencePaymentReceived";
import { noPermissions } from "@/lib/residences/permissions";
import { openSupportCase } from "@/lib/support/openSupportCase";
import { consumeRateLimit } from "@/lib/security/rateLimit";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const hasCreds = Boolean(URL_ && ANON && SERVICE);
const DEV_REF = "gyfbtsuibmecefwovdgh";
const PASSWORD = `Aud-${Math.random().toString(36).slice(2)}-Zz9!`;
const TAG = `audit-sec-${Date.now()}`;

type Rec = { id: string; control: string; expected: string; got: string; status: "comprobado" | "fallido" | "parcial" };
const evidence: Rec[] = [];
function rec(id: string, control: string, expected: string, got: string, ok: boolean) {
  evidence.push({ id, control, expected, got, status: ok ? "comprobado" : "fallido" });
}

describe.skipIf(!hasCreds)("auditoría complementaria 2026-11-15 (dev, fixtures aislados)", () => {
  let admin: SupabaseClient;
  const cleanupUsers: string[] = [];
  let studentA: TestStudent, studentB: TestStudent;
  let o1: string, o2: string, s1: string, s0: string, sX: string, ad: string;
  let r1: string, r2: string, rt1: string;
  let appA: string, snapA: string, fileA: string, fileB: string, filePay: string;
  let pathA: string, pathB: string;
  const emails: Record<string, string> = {};
  const extraRows: { table: string; id: string }[] = [];

  async function mkUser(role: string, label: string): Promise<string> {
    const email = `${TAG}-${label}@estured.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error || !data.user) throw new Error(`mkUser ${label}: ${error?.message}`);
    const id = data.user.id;
    cleanupUsers.push(id);
    emails[label] = email;
    await admin.from("users").insert({ id, email, phone: "+54 11 5555-0000", primary_role: role });
    await admin.from("user_roles").insert({ user_id: id, role, scope_type: "global" });
    return id;
  }
  async function session(email: string): Promise<SupabaseClient> {
    const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`login ${email}: ${error.message}`);
    return c;
  }
  let actorsCache: Record<string, SupabaseClient> | null = null;
  async function getActors(): Promise<Record<string, SupabaseClient>> {
    if (actorsCache) return actorsCache;
    actorsCache = {
      anon: createClient(URL_, ANON, { auth: { persistSession: false } }),
      studentA: await session(emails.a),
      studentB: await session(emails.b),
      owner1: await session(emails.o1),
      owner2: await session(emails.o2),
      staff1: await session(emails.s1),
      staff0: await session(emails.s0),
      staffX: await session(emails.sx),
    };
    return actorsCache;
  }
  async function mkResidence(label: string, ownerId: string) {
    const { data: r, error } = await admin
      .from("residences")
      .insert({
        name: `Residencia Test Integración (auditoría ${label})`,
        slug: `residencia-test-${TAG}-${label}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 5,
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (error || !r) throw new Error(`residencia ${label}: ${error?.message}`);
    await admin.from("residence_users").insert({ residence_id: r.id, user_id: ownerId, role: "owner", is_active: true });
    const { data: rt } = await admin
      .from("room_types")
      .insert({ residence_id: r.id, name: "Individual", monthly_price_usd: 300, monthly_price_ars: 456000 })
      .select("id")
      .single();
    return { id: r.id as string, rt: rt!.id as string };
  }
  async function putFile(studentProfileId: string, ownerUser: string, docType: string, bucket = "student-documents", entity = "student_profiles") {
    // PNG mínimo válido de 1x1
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const path = `${studentProfileId}/audit-${crypto.randomUUID()}.png`;
    const up = await admin.storage.from(bucket).upload(path, new Blob([png], { type: "image/png" }), { contentType: "image/png" });
    if (up.error) throw new Error(`upload fixture: ${up.error.message}`);
    const { data, error } = await admin
      .from("files")
      .insert({
        owner_user_id: ownerUser,
        related_entity_type: entity,
        related_entity_id: studentProfileId,
        bucket,
        storage_path: path,
        filename: "audit.png",
        mime_type: "image/png",
        size_bytes: png.length,
        visibility: "private",
        document_type: docType,
        status: "uploaded",
        uploaded_by_user_id: ownerUser,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`files fixture: ${error?.message}`);
    return { id: data.id as string, path, bucket };
  }
  async function setApp(status: string) {
    await admin.from("application_requests").update({ status }).eq("id", appA);
  }

  beforeAll(async () => {
    if (!URL_.includes(DEV_REF)) throw new Error("Este test solo corre contra estured-dev");
    admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
    try {
      await setup();
    } catch (e) {
      await cleanup(); // Vitest no corre afterAll si beforeAll lanza: limpiar acá para no dejar residuo.
      throw e;
    }
  }, 120_000);

  async function setup() {

    studentA = await createTestStudent(admin, `${TAG}-a`);
    studentB = await createTestStudent(admin, `${TAG}-b`);
    cleanupUsers.push(studentA.userId, studentB.userId);
    // createTestStudent usa una contraseña aleatoria propia: se pisa por la del test para poder iniciar sesión.
    for (const s of [studentA, studentB]) await admin.auth.admin.updateUserById(s.userId, { password: PASSWORD });
    emails.a = studentA.email;
    emails.b = studentB.email;

    o1 = await mkUser("residence_owner", "o1");
    o2 = await mkUser("residence_owner", "o2");
    s1 = await mkUser("residence_staff", "s1");
    s0 = await mkUser("residence_staff", "s0");
    sX = await mkUser("residence_staff", "sx");
    ad = await mkUser("admin_operational", "ad").catch(async () => mkUser("registered_user", "ad"));

    const R1 = await mkResidence("r1", o1);
    const R2 = await mkResidence("r2", o2);
    r1 = R1.id;
    r2 = R2.id;
    rt1 = R1.rt;
    const perms = (on: string[]) => Object.fromEntries(on.map((k) => [k, true]));
    await admin.from("residence_users").insert([
      { residence_id: r1, user_id: s1, role: "staff", is_active: true, permissions: perms(["payments.residence", "residents.manage"]) },
      { residence_id: r1, user_id: s0, role: "staff", is_active: true, permissions: {} as Record<string, boolean> },
      { residence_id: r2, user_id: sX, role: "staff", is_active: true, permissions: perms(["payments.residence", "residents.manage"]) },
    ]);
    // staff sin permisos: `{}` toma los valores iniciales (DR11); se fuerza todo en false explícito.
    await admin.from("residence_users").update({ permissions: noPermissions() }).eq("residence_id", r1).eq("user_id", s0);

    const { data: snap } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: r1,
        room_type_id: rt1,
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
    snapA = snap!.id;
    const { data: app } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: studentA.profileId,
        initiated_by: "student",
        contact_target: "student",
        residence_id: r1,
        room_type_id: rt1,
        status: "residence_payment_pending",
        desired_start_date: "2026-12-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (auditoría).",
        snapshot_original_id: snapA,
        created_by_user_id: studentA.userId,
      })
      .select("id")
      .single();
    appA = app!.id;
    await admin.from("application_snapshots").update({ application_request_id: appA }).eq("id", snapA);
    await admin.from("external_residence_payments").insert({
      application_request_id: appA,
      residence_id: r1,
      student_profile_id: studentA.profileId,
      status: "pending",
    });

    const fa = await putFile(studentA.profileId, studentA.userId, "student_identity");
    const fb = await putFile(studentB.profileId, studentB.userId, "student_identity");
    const fp = await putFile(studentA.profileId, studentA.userId, "residence_payment_receipt", "payment-proofs", "student_profiles");
    fileA = fa.id;
    pathA = fa.path;
    fileB = fb.id;
    pathB = fb.path;
    filePay = fp.id;
  }

  afterAll(async () => {
    await cleanup();
  }, 120_000);

  async function cleanup() {
    if (!admin) return;
    try {
      writeFileSync(resolve(__dirname, "results.json"), JSON.stringify({ tag: "sanitizado", generated: new Date().toISOString(), evidence }, null, 2));
    } catch {}
    const profileIds = [studentA?.profileId, studentB?.profileId].filter(Boolean) as string[];
    // reservas/fees creados por la prueba de concurrencia
    if (appA) {
      const { data: resv } = await admin.from("reservations").select("id").eq("application_request_id", appA);
      for (const r of resv ?? []) {
        await admin.from("reservations").update({ estured_fee_payment_id: null, booking_receipt_id: null }).eq("id", r.id);
        await admin.from("estured_fee_payments").delete().eq("reservation_id", r.id);
        await admin.from("external_residence_payments").update({ reservation_id: null }).eq("application_request_id", appA);
        await admin.from("reservations").delete().eq("id", r.id);
      }
      await admin.from("application_status_events").delete().eq("application_request_id", appA);
      await admin.from("external_residence_payments").delete().eq("application_request_id", appA);
    }
    await admin.from("residence_document_access_log").delete().in("student_profile_id", profileIds);
    await admin.from("support_cases").update({ resolution_notes: null }).eq("residence_id", r1 ?? "");
    const { data: fl } = await admin.from("files").select("id, bucket, storage_path").in("uploaded_by_user_id", cleanupUsers);
    for (const f of fl ?? []) await admin.storage.from(f.bucket).remove([f.storage_path]);
    await admin.from("files").delete().in("uploaded_by_user_id", cleanupUsers);
    await admin.from("files").delete().in("related_entity_id", profileIds);
    await admin.from("audit_logs").delete().in("actor_user_id", cleanupUsers);
    await admin.from("notifications").delete().in("user_id", cleanupUsers);
    await admin.from("consents").delete().in("user_id", cleanupUsers);
    await admin.from("resident_stays").delete().in("student_profile_id", profileIds);
    if (appA) await admin.from("application_requests").delete().eq("id", appA);
    await admin.from("residence_users").delete().in("residence_id", [r1, r2].filter(Boolean));
    for (const rid of [r1, r2].filter(Boolean)) await deleteResidenceCascade(admin, rid);
    for (const s of [studentA, studentB]) await deleteTestStudent(admin, s);
    for (const id of cleanupUsers) {
      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("users").delete().eq("id", id);
      await admin.auth.admin.deleteUser(id);
    }
    for (const x of extraRows) await admin.from(x.table).delete().eq("id", x.id);
  }

  // ───────────────────────── A. Aislamiento con sesiones reales ─────────────────────────
  it("A1 lecturas cruzadas por REST con JWT real (visitante, estudiantes, owners, staff)", async () => {
    await admin.from("notifications").insert({ user_id: studentA.userId, type: "test", title: "audit", body: "audit" } as never);
    await admin.from("residence_document_access_log").insert({
      file_id: fileA, document_type: "student_identity", student_profile_id: studentA.profileId, residence_id: r1, user_id: o1,
      actor_role: "residence_owner", access_basis: "applicant", application_request_id: appA,
    });
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const actors = await getActors();
    void anon;
    const probes: { table: string; id: string; col?: string; allow: string[] }[] = [
      { table: "application_requests", id: appA, allow: ["studentA", "owner1", "staff1", "staff0"] },
      { table: "application_snapshots", id: snapA, allow: ["studentA", "owner1", "staff1", "staff0"] },
      { table: "files", id: fileA, allow: ["studentA"] },
      { table: "files", id: fileB, allow: ["studentB"] },
      { table: "student_profiles", id: studentA.profileId, allow: ["studentA"] },
      { table: "student_profiles", id: studentB.profileId, allow: ["studentB"] },
      { table: "users", id: studentA.userId, allow: ["studentA"] },
      { table: "residence_users", id: r1, col: "residence_id", allow: ["owner1", "staff1", "staff0"] },
    ];
    for (const p of probes) {
      for (const [name, c] of Object.entries(actors)) {
        const { data } = await c.from(p.table).select("*").eq(p.col ?? "id", p.id);
        const seen = (data ?? []).length > 0;
        const should = p.allow.includes(name);
        // Las celdas "permitido" son informativas (diseño); la falla real es VER algo que no corresponde.
        const ok = should || !seen;
        rec(`A1:${p.table}:${p.id === studentB.profileId || p.id === fileB ? "B-" : ""}${name}`, `lectura de ${p.table}(${p.col ?? "id"}) como ${name}`, should ? "visible o no (diseño)" : "sin filas", seen ? "filas" : "sin filas", ok);
        if (!should) expect(seen, `${name} no debería ver ${p.table}`).toBe(false);
      }
    }
    for (const t of ["residence_document_access_log", "document_access_log", "audit_logs"]) {
      for (const [name, c] of Object.entries(actors)) {
        const { data, error } = await c.from(t).select("*").limit(5);
        const seen = (data ?? []).length;
        rec(`A1:${t}:${name}`, `lectura de ${t} como ${name}`, "sin filas / denegado", `${seen} filas${error ? " (error)" : ""}`, seen === 0);
        expect(seen).toBe(0);
      }
    }
    const { data: ownNotif } = await actors.studentA.from("notifications").select("id").eq("user_id", studentA.userId);
    const { data: crossNotif } = await actors.studentB.from("notifications").select("id").eq("user_id", studentA.userId);
    rec("A1:notifications", "notificaciones propias visibles / ajenas no", "A ve 1; B ve 0", `A=${ownNotif?.length ?? 0}; B=${crossNotif?.length ?? 0}`, (crossNotif ?? []).length === 0);
    expect(crossNotif ?? []).toHaveLength(0);
  }, 120_000);

  it("A2 mutaciones directas con JWT real: roles, propietarios, estados y permisos", async () => {
    const actors = await getActors();
    const tries: { id: string; actor: string; run: (c: SupabaseClient) => PromiseLike<{ error: unknown; count?: number | null; data?: unknown }> }[] = [
      { id: "estudianteB→solicitud ajena", actor: "studentB", run: (c) => c.from("application_requests").update({ status: "cancelled_by_student" }).eq("id", appA).select("id") },
      { id: "owner2→solicitud de R1", actor: "owner2", run: (c) => c.from("application_requests").update({ status: "rejected" }).eq("id", appA).select("id") },
      { id: "estudianteA→salta estado propio", actor: "studentA", run: (c) => c.from("application_requests").update({ status: "converted_to_reservation" }).eq("id", appA).select("id") },
      { id: "staff0→se da permisos", actor: "staff0", run: (c) => c.from("residence_users").update({ permissions: { "payments.residence": true } }).eq("user_id", s0).select("id") },
      { id: "staff0→se vuelve owner", actor: "staff0", run: (c) => c.from("residence_users").update({ role: "owner" }).eq("user_id", s0).select("id") },
      { id: "staff0→se suma a R2", actor: "staff0", run: (c) => c.from("residence_users").insert({ residence_id: r2, user_id: s0, role: "owner", is_active: true }).select("id") },
      { id: "estudianteA→rol admin", actor: "studentA", run: (c) => c.from("users").update({ primary_role: "admin_operational" }).eq("id", studentA.userId).select("id") },
      { id: "estudianteA→user_roles admin", actor: "studentA", run: (c) => c.from("user_roles").insert({ user_id: studentA.userId, role: "admin_operational", scope_type: "global" }).select("id") },
      { id: "estudianteA→desbloquearse", actor: "studentA", run: (c) => c.from("users").update({ is_blocked: false, is_active: true }).eq("id", studentA.userId).select("id") },
      { id: "estudianteB→archivo ajeno", actor: "studentB", run: (c) => c.from("files").update({ related_entity_id: studentB.profileId }).eq("id", fileA).select("id") },
      { id: "estudianteB→borra archivo ajeno", actor: "studentB", run: (c) => c.from("files").delete().eq("id", fileA).select("id") },
      { id: "estudianteB→perfil ajeno", actor: "studentB", run: (c) => c.from("student_profiles").update({ career: "X" }).eq("id", studentA.profileId).select("id") },
      { id: "estudianteB→forja log DR48", actor: "studentB", run: (c) => c.from("residence_document_access_log").insert({ document_type: "other", student_profile_id: studentA.profileId, residence_id: r1, user_id: studentB.userId, actor_role: "residence_owner", access_basis: "resident" }).select("id") },
      { id: "owner1→residencia de R2", actor: "owner1", run: (c) => c.from("residences").update({ name: "pwn" }).eq("id", r2).select("id") },
      { id: "owner2→residencia de R1", actor: "owner2", run: (c) => c.from("residences").update({ status: "paused_by_admin" }).eq("id", r1).select("id") },
    ];
    for (const t of tries) {
      const { data, error } = await t.run(actors[t.actor]);
      const rows = Array.isArray(data) ? data.length : 0;
      rec(`A2:${t.id}`, `mutación directa denegada: ${t.id}`, "0 filas afectadas o error", `${rows} filas${error ? ", error" : ""}`, rows === 0);
      expect(rows, t.id).toBe(0);
    }
    // estado persistido intacto
    const { data: a } = await admin.from("application_requests").select("status").eq("id", appA).single();
    const { data: u } = await admin.from("users").select("primary_role, is_blocked").eq("id", studentA.userId).single();
    const { data: ru } = await admin.from("residence_users").select("role").eq("user_id", s0).eq("residence_id", r1).single();
    const intact = a?.status === "residence_payment_pending" && u?.primary_role === "student" && ru?.role === "staff";
    rec("A2:estado-persistido", "tras las mutaciones, estado/rol/permiso sin cambios", "intacto", intact ? "intacto" : "CAMBIÓ", intact);
    expect(intact).toBe(true);
  }, 120_000);

  it("A3 Storage y RPC con JWT real", async () => {
    const actors = await getActors();
    for (const [name, bucket, path] of [
      ["studentB", "student-documents", pathA],
      ["studentA", "student-documents", pathA], // el propio dueño tampoco accede directo: todo pasa por el servidor
      ["owner1", "student-documents", pathA],
      ["anon", "student-documents", pathA],
    ] as const) {
      const c = actors[name];
      const s = await c.storage.from(bucket).createSignedUrl(path, 60);
      const d = await c.storage.from(bucket).download(path);
      const l = await c.storage.from(bucket).list(path.split("/")[0]);
      const denied = !s.data?.signedUrl && !d.data && (l.data ?? []).length === 0;
      rec(`A3:storage:${name}`, `Storage directo ${bucket} como ${name}`, "firmar/descargar/listar denegado", denied ? "denegado" : "PERMITIDO", denied);
      expect(denied).toBe(true);
    }
    const rpcs: [string, Record<string, unknown>][] = [
      ["consume_rate_limit", { p_bucket: "x", p_key: "x", p_window_seconds: 60, p_max: 1 }],
      ["peek_rate_limit", { p_bucket: "x", p_key: "x", p_window_seconds: 60, p_max: 1 }],
      ["create_residence_private_details", {}],
      ["publish_residence_regulation", {}],
      ["consume_invite_otp_attempt", {}],
      ["register_invite_otp_send", {}],
      ["ensure_model_regulation_version", {}],
    ];
    for (const name of ["anon", "studentA", "owner1"]) {
      for (const [fn, args] of rpcs) {
        const { error } = await actors[name].rpc(fn, args);
        const code = (error as { code?: string } | null)?.code ?? "sin-error";
        const denied = !!error && ["42501", "PGRST202", "PGRST301"].includes(code);
        rec(`A3:rpc:${fn}:${name}`, `RPC privilegiada ${fn} como ${name}`, "denegada (42501/404)", code, denied);
        expect(denied, `${fn} como ${name}: ${code}`).toBe(true);
      }
    }
  }, 120_000);

  it("A4 usuario bloqueado con sesión previa: RLS restrictivo corta lecturas propias", async () => {
    const sessA = await session(emails.a);
    const before = await sessA.from("application_requests").select("id").eq("id", appA);
    await admin.from("users").update({ is_blocked: true }).eq("id", studentA.userId);
    const after = await sessA.from("application_requests").select("id").eq("id", appA);
    const afterProfile = await sessA.from("student_profiles").select("id").eq("id", studentA.profileId);
    await admin.from("users").update({ is_blocked: false }).eq("id", studentA.userId);
    const ok = (before.data ?? []).length === 1 && (after.data ?? []).length === 0 && (afterProfile.data ?? []).length === 0;
    rec("A4:bloqueado", "estudiante bloqueado con JWT vigente deja de leer sus datos (RLS)", "antes 1 fila / después 0", `antes=${before.data?.length ?? 0} después=${after.data?.length ?? 0}`, ok);
    expect(ok).toBe(true);
  }, 60_000);

  // ───────────────────────── B. DR48 ─────────────────────────
  it("B1 DR48: matriz de autorización, registro y expiración del enlace", async () => {
    const grant = (userId: string, residenceId: string, fileId: string) => grantResidenceDocumentAccess(admin, { userId, residenceId, fileId });
    const logCount = async () => (await admin.from("residence_document_access_log").select("id", { count: "exact", head: true }).eq("file_id", fileA)).count ?? 0;
    const base = await logCount();

    const okOwner = await grant(o1, r1, fileA);
    rec("B1:owner-applicant", "owner abre doc de solicitante con pago habilitado", "ok + link", okOwner.ok ? "ok" : okOwner.error, okOwner.ok);
    expect(okOwner.ok).toBe(true);
    const { data: logs } = await admin.from("residence_document_access_log").select("*").eq("file_id", fileA).order("accessed_at", { ascending: false }).limit(1);
    const lg = (logs ?? [])[0] as Record<string, unknown> | undefined;
    const logOk = !!lg && lg.user_id === o1 && lg.residence_id === r1 && lg.student_profile_id === studentA.profileId && lg.access_basis === "applicant" && lg.actor_role === "residence_owner" && lg.application_request_id === appA;
    rec("B1:log-contenido", "el registro guarda actor, documento, residencia, vínculo y solicitud", "campos correctos y sin URL", logOk ? "correcto" : "incorrecto", logOk);
    expect(logOk).toBe(true);
    expect(JSON.stringify(lg)).not.toMatch(/token=|signedUrl|\/sign\//);
    if (okOwner.ok) {
      const tok = new URL(okOwner.url).searchParams.get("token") ?? "";
      const payload = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString("utf8")) as { exp: number; iat?: number };
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      rec("B1:ttl", "el enlace firmado expira en ≤ 300 s", "≤ 300 s", `${ttl} s restantes`, ttl > 0 && ttl <= 300);
      expect(ttl).toBeLessThanOrEqual(300);
      (globalThis as Record<string, unknown>).__link = okOwner.url;
    }

    const cases: { id: string; run: () => ReturnType<typeof grant>; wantOk: boolean }[] = [
      { id: "staff con payments.residence (solicitante)", run: () => grant(s1, r1, fileA), wantOk: true },
      { id: "staff sin permisos", run: () => grant(s0, r1, fileA), wantOk: false },
      { id: "owner de otra residencia (R2) apuntando a R2", run: () => grant(o2, r2, fileA), wantOk: false },
      { id: "owner de R2 con residenceId manipulado a R1", run: () => grant(o2, r1, fileA), wantOk: false },
      { id: "owner de R1 sobre doc de estudiante sin vínculo", run: () => grant(o1, r1, fileB), wantOk: false },
      { id: "owner de R1 con residenceId manipulado a R2", run: () => grant(o1, r2, fileA), wantOk: false },
      { id: "archivo de otro bucket/tipo (comprobante)", run: () => grant(o1, r1, filePay), wantOk: false },
      { id: "id de archivo inexistente", run: () => grant(o1, r1, crypto.randomUUID()), wantOk: false },
      { id: "usuario sin vínculo (estudiante B)", run: () => grant(studentB.userId, r1, fileA), wantOk: false },
    ];
    for (const c of cases) {
      const res = await c.run();
      rec(`B1:${c.id}`, c.id, c.wantOk ? "ok" : "denegado", res.ok ? "ok" : res.error, res.ok === c.wantOk);
      expect(res.ok, c.id).toBe(c.wantOk);
    }
    const afterDenied = await logCount();
    // 2 aperturas exitosas (owner, staff1) sobre fileA
    rec("B1:log-solo-exitosos", "solo las aperturas exitosas dejan registro", `${base + 2} filas`, `${afterDenied} filas`, afterDenied === base + 2);
    expect(afterDenied).toBe(base + 2);
  }, 120_000);

  it("B2 DR48: cambios de estado, retiro de permisos y vínculos", async () => {
    const grant = (userId = o1, fileId = fileA, residenceId = r1) => grantResidenceDocumentAccess(admin, { userId, residenceId, fileId });
    for (const st of ["rejected", "cancelled_by_student", "contact_established", "submitted"]) {
      await setApp(st);
      const r = await grant();
      rec(`B2:estado:${st}`, `solicitud en ${st} no habilita documentos`, "denegado", r.ok ? "ok" : "denegado", !r.ok);
      expect(r.ok, st).toBe(false);
    }
    await setApp("converted_to_reservation");
    const noRes = await grant();
    rec("B2:convertida-sin-reserva", "convertida sin reserva viva no habilita", "denegado", noRes.ok ? "ok" : "denegado", !noRes.ok);
    expect(noRes.ok).toBe(false);
    await setApp("residence_payment_pending");

    // retiro de permisos / desactivación del staff: efecto inmediato en nuevas emisiones
    await admin.from("residence_users").update({ permissions: { "payments.residence": false, "residents.manage": false } }).eq("user_id", s1).eq("residence_id", r1);
    const noPerm = await grant(s1);
    await admin.from("residence_users").update({ permissions: { "payments.residence": true, "residents.manage": true }, is_active: false }).eq("user_id", s1).eq("residence_id", r1);
    const inactive = await grant(s1);
    await admin.from("residence_users").update({ is_active: true }).eq("user_id", s1).eq("residence_id", r1);
    rec("B2:permiso-retirado", "staff con permiso retirado no obtiene nuevos enlaces", "denegado", noPerm.ok ? "ok" : "denegado", !noPerm.ok);
    rec("B2:staff-inactivo", "staff desvinculado no obtiene nuevos enlaces", "denegado", inactive.ok ? "ok" : "denegado", !inactive.ok);
    expect(noPerm.ok).toBe(false);
    expect(inactive.ok).toBe(false);

    // enlace ya emitido sigue válido hasta expirar (comportamiento previsto, no fallo)
    const link = (globalThis as Record<string, unknown>).__link as string | undefined;
    if (link) {
      const res = await fetch(link);
      rec("B2:enlace-emitido", "un enlace ya emitido sigue funcionando hasta su expiración (≤ 300 s)", "200 (periodo de validez previsto)", `HTTP ${res.status}`, res.status === 200);
      expect(res.status).toBe(200);
    }

    // estadía vigente → casillero residents.manage
    const { data: stay, error: stayErr } = await admin
      .from("resident_stays")
      .insert({ student_profile_id: studentA.profileId, residence_id: r1, room_type_id: rt1, invite_email: studentA.email, status: "active", is_current: true, start_date: "2026-12-01", expected_end_date: "2027-06-01" })
      .select("id")
      .single();
    expect(stayErr?.message ?? null).toBeNull();
    await setApp("rejected");
    const resOk = await grant(s1);
    await admin.from("resident_stays").update({ is_current: false, status: "inactive" }).eq("id", stay!.id);
    const resGone = await grant(s1);
    rec("B2:residente", "staff con residents.manage abre docs de residente vigente", "ok", resOk.ok ? "ok" : resOk.error, resOk.ok);
    rec("B2:salida", "tras la salida del residente no hay nuevos enlaces", "denegado", resGone.ok ? "ok" : "denegado", !resGone.ok);
    expect(resOk.ok).toBe(true);
    expect(resGone.ok).toBe(false);
    await setApp("residence_payment_pending");
  }, 120_000);

  it("B3 DR48: fallos de base, registro y firma fallan cerrados", async () => {
    function failing(table: string, op: "select" | "insert", sign = false): SupabaseClient {
      return new Proxy(admin, {
        get(target, prop, receiver) {
          if (prop === "from") {
            return (t: string) => {
              const q = target.from(t) as unknown as Record<string, unknown>;
              if (t !== table) return q;
              return new Proxy(q, {
                get(qt, qp) {
                  if (qp === op) return () => chain();
                  return (qt as Record<string | symbol, unknown>)[qp];
                },
              });
            };
          }
          if (prop === "storage" && sign) return { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "sim" } }) }) };
          return Reflect.get(target, prop, receiver);
        },
      }) as SupabaseClient;
    }
    function chain(): Record<string, unknown> {
      const r: Record<string, unknown> = {};
      const res = { data: null, error: { code: "XX000", message: "sim" } };
      for (const m of ["select", "eq", "in", "limit", "maybeSingle", "single", "order"]) r[m] = () => r;
      (r as { then: unknown }).then = (ok: (v: unknown) => void) => ok(res);
      r.maybeSingle = async () => res;
      return r;
    }
    const base = (await admin.from("residence_document_access_log").select("id", { count: "exact", head: true }).eq("file_id", fileA)).count ?? 0;
    const failLog = await grantResidenceDocumentAccess(failing("residence_document_access_log", "insert"), { userId: o1, residenceId: r1, fileId: fileA });
    const failRead = await grantResidenceDocumentAccess(failing("files", "select"), { userId: o1, residenceId: r1, fileId: fileA });
    const failBases = await grantResidenceDocumentAccess(failing("resident_stays", "select"), { userId: o1, residenceId: r1, fileId: fileA });
    const failMember = await grantResidenceDocumentAccess(failing("residence_users", "select"), { userId: o1, residenceId: r1, fileId: fileA });
    const failSign = await grantResidenceDocumentAccess(failing("none", "select", true), { userId: o1, residenceId: r1, fileId: fileA });
    const after = (await admin.from("residence_document_access_log").select("id", { count: "exact", head: true }).eq("file_id", fileA)).count ?? 0;
    rec("B3:falla-registro", "si falla el registro no se entrega enlace", "denegado", failLog.ok ? "ok" : "denegado", !failLog.ok);
    rec("B3:falla-lectura-archivo", "si falla la lectura del archivo no hay enlace", "denegado", failRead.ok ? "ok" : "denegado", !failRead.ok);
    rec("B3:falla-vinculos", "si falla la lectura de vínculos no hay enlace", "denegado", failBases.ok ? "ok" : "denegado", !failBases.ok);
    rec("B3:falla-membresia", "si falla la verificación de membresía no hay enlace", "denegado", failMember.ok ? "ok" : "denegado", !failMember.ok);
    // Si falla la firma, el registro ya se escribió (se sobre-informa una apertura que no ocurrió): comportamiento a documentar.
    rec("B3:falla-firma", "si falla la firma no hay enlace (el registro queda, sobre-informa)", "denegado", failSign.ok ? "ok" : "denegado", !failSign.ok);
    expect(failLog.ok || failRead.ok || failBases.ok || failMember.ok || failSign.ok).toBe(false);
    rec("B3:log-por-falla-firma", "fallo de firma deja un registro sin enlace entregado (sobre-registro)", "1 fila de más", `${after - base} filas de más`, after - base <= 1);
  }, 120_000);

  // ───────────────────────── D. Concurrencia / idempotencia ─────────────────────────
  it("D1 confirmaciones simultáneas y repetidas de «pago recibido»", async () => {
    await setApp("residence_payment_pending");
    const call = () =>
      recordResidencePaymentReceived(admin, {
        applicationId: appA,
        actorUserId: o1,
        paymentCurrency: "ARS",
        paymentMethodLabel: "Transferencia bancaria (auditoría)",
        confirmationAccepted: true,
        receiptFile: null,
      });
    const results = await Promise.all([call(), call(), call()]);
    const okCount = results.filter((r) => r.ok).length;
    const { data: resv } = await admin.from("reservations").select("id").eq("application_request_id", appA);
    const resIds = (resv ?? []).map((r) => r.id as string);
    const { data: fees } = resIds.length ? await admin.from("estured_fee_payments").select("id").in("reservation_id", resIds) : { data: [] as { id: string }[] };
    const { data: events } = await admin.from("application_status_events").select("id").eq("application_request_id", appA).eq("to_status", "converted_to_reservation");
    const dup = resIds.length !== 1 || (fees ?? []).length !== 1 || (events ?? []).length !== 1 || okCount !== 1;
    rec(
      "D1:confirmacion-concurrente",
      "3 confirmaciones simultáneas del mismo pago: una sola reserva y un solo fee",
      "1 reserva, 1 fee, 1 evento",
      `${okCount} ok; ${resIds.length} reservas; ${(fees ?? []).length} fees; ${(events ?? []).length} eventos`,
      !dup,
    );
    // Reintento posterior (timeout): debe rechazarse, no duplicar
    const retry = await call();
    const { data: resv2 } = await admin.from("reservations").select("id").eq("application_request_id", appA);
    rec("D1:reintento-posterior", "reintento tras el éxito se rechaza y no duplica", "rechazado; sin reservas nuevas", `${retry.ok ? "ok" : "rechazado"}; ${(resv2 ?? []).length} reservas`, !retry.ok && (resv2 ?? []).length === resIds.length);
    expect(retry.ok).toBe(false);
    // SEG15-01 corregido (0089 + reclamo atómico): ahora es una regresión estricta.
    expect(dup).toBe(false);
  }, 120_000);

  it("H1 consumeRateLimit: atómico bajo concurrencia (login/registro/subidas)", async () => {
    const key = `${TAG}-conc`;
    const calls = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit({ bucket: "audit_conc", key, windowSeconds: 120, max: 5 }, admin)));
    const okCount = calls.filter((c) => c.ok).length;
    rec("H1:rate-limit-atomico", "20 llamadas simultáneas con tope 5 permiten exactamente 5", "5 ok", `${okCount} ok`, okCount === 5);
    expect(okCount).toBe(5);
  }, 60_000);

  // ───────────────────────── G / E ─────────────────────────
  it("G1 soporte: sin tope por usuario de casos ni de evidencia acumulada (SEG14-03 equivalente)", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const N = 6;
    const results = [];
    for (let i = 0; i < N; i++) {
      results.push(
        await openSupportCase(admin, {
          actorUserId: studentA.userId,
          actorRole: "student",
          residenceId: r1,
          description: `Caso de auditoría número ${i + 1}: texto de relleno para superar el mínimo.`,
          termsReminderAccepted: true,
          evidenceFiles: [new File([png], `evidencia-${i}.png`, { type: "image/png" })],
        } as never),
      );
    }
    const ok = results.filter((r) => (r as { ok: boolean }).ok).length;
    const { data: cases } = await admin.from("support_cases").select("id").eq("opened_by_user_id", studentA.userId);
    const { data: ev } = await admin.from("files").select("id").eq("bucket", "support-evidence").eq("uploaded_by_user_id", studentA.userId);
    rec("G1:soporte-sin-tope", `${N} casos seguidos con evidencia por el mismo usuario: se espera un freno/cuota`, "freno o cuota que corte antes de N", `${ok} de ${N} aceptados; ${(cases ?? []).length} casos; ${(ev ?? []).length} archivos`, ok < N);
    // SEG15-02 corregido (tope de 5 casos por hora): regresión estricta.
    expect(ok).toBeLessThan(N);
  }, 120_000);

  it("E1 bloqueo en Auth: ban corta login nuevo; el token ya emitido muere por RLS (A4)", async () => {
    const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const first = await c.auth.signInWithPassword({ email: emails.b, password: PASSWORD });
    await admin.auth.admin.updateUserById(studentB.userId, { ban_duration: "876000h" });
    const c2 = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const banned = await c2.auth.signInWithPassword({ email: emails.b, password: PASSWORD });
    const refresh = first.data.session ? await c.auth.refreshSession({ refresh_token: first.data.session.refresh_token }) : null;
    const getUser = first.data.session ? await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.getUser(first.data.session.access_token) : null;
    await admin.auth.admin.updateUserById(studentB.userId, { ban_duration: "none" });
    rec("E1:login-baneado", "usuario baneado no inicia sesión", "error", banned.error ? "error" : "SESIÓN", !!banned.error);
    rec("E1:refresh-baneado", "el refresh token de un baneado no renueva", "error", refresh?.error ? "error" : "RENOVÓ", !!refresh?.error);
    rec("E1:getUser-baneado", "getUser (usado por getSafeUser) rechaza el access token de un baneado", "error", getUser?.error ? "error" : "VÁLIDO", !!getUser?.error);
    expect(banned.error).toBeTruthy();
  }, 120_000);
});
