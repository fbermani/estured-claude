import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorRole: string; action: string; entityId?: string | null }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => {
    audits.push(e);
    return true;
  },
}));

vi.mock("@/lib/family/access", () => ({
  loadActiveFamilyLink: async (_a: unknown, userId: string, studentProfileId: string) =>
    userId === "martin" && studentProfileId === "sp-menor" ? { linkId: "l1", studentProfileId, permissions: {} } : null,
}));

import { createInMemorySupabase, type InMemoryOptions, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import { publishRegulationVersion, MIGRATION_PENDING_MESSAGE } from "@/lib/regulations/publish";
import { loadCurrentRegulation, listRegulationVersions } from "@/lib/regulations/current";
import {
  REGULATION_CHANGED_MESSAGE,
  REGULATION_MISSING_HASH_MESSAGE,
  REGULATION_NOT_ACCEPTED_MESSAGE,
  acceptRegulationForApplication,
  recordRegulationAcceptance,
  regulationAcceptanceEnabled,
  resolveRegulationToAccept,
} from "@/lib/regulations/acceptance";
import { REGULATION_PENDING_FOR_RESIDENCE_MESSAGE, assertRegulationAccepted } from "@/lib/regulations/gate";
import { buildModelText } from "@/lib/regulations/modelTemplate";
import { hashRegulationText } from "@/lib/regulations/text";

const NORTE = "res-norte";
const RIO = "res-rio";
const TEXT_A = `CONVIVENCIA\n\nArt. 1. Silencio\n${"Se guarda silencio desde las 23:00 hasta las 7:00 en toda la residencia. ".repeat(4)}`;
const TEXT_B = `${TEXT_A}\n\nArt. 2. Visitas\nLas visitas se reciben de 10:00 a 21:00 y se anuncian en recepción.`;

type Tables = Record<string, Row[]>;
type RpcResult = { data: unknown; error: { code: string; message: string } | null };

/** Emulación en JS de las funciones SQL de la 0053 (la lógica real es SQL: acá se prueba cómo el código usa su resultado y sus errores). */
const rpcHandlers: NonNullable<InMemoryOptions["rpc"]> = {
  publish_residence_regulation: (a, t: Tables): RpcResult => {
    const rows = t.residence_regulation_versions;
    const mine = rows.filter((r) => r.residence_id === a.p_residence_id);
    const current = mine.find((r) => r.status === "published");
    if (current && current.content_hash === a.p_hash) return { data: null, error: { code: "P0001", message: "no_changes" } };
    const next = Math.max(0, ...mine.map((r) => Number(r.version_number))) + 1;
    if (current) current.status = "superseded";
    const row = { id: crypto.randomUUID(), residence_id: a.p_residence_id, version_number: next, source: a.p_source, model_version: a.p_model_version, content: a.p_content, content_hash: a.p_hash, status: "published", published_at: new Date().toISOString(), created_by_user_id: a.p_actor_user_id };
    rows.push(row);
    const res = t.residences.find((r) => r.id === a.p_residence_id);
    if (res) res.current_regulation_version_id = row.id;
    return { data: { id: row.id, version_number: next, previous_version_number: current?.version_number ?? null, previous_hash: current?.content_hash ?? null }, error: null };
  },
  ensure_model_regulation_version: (a, t: Tables): RpcResult => {
    const rows = t.residence_regulation_versions;
    const mine = rows.filter((r) => r.residence_id === a.p_residence_id);
    const current = mine.find((r) => r.status === "published");
    if (current) {
      const stale = current.source === "model" && (current.content as { base_model?: boolean }).base_model === true && current.content_hash !== a.p_hash;
      if (!stale) return { data: { id: current.id, content_hash: current.content_hash }, error: null };
      current.status = "superseded";
    }
    const next = Math.max(0, ...mine.map((r) => Number(r.version_number))) + 1;
    const row = { id: crypto.randomUUID(), residence_id: a.p_residence_id, version_number: next, source: "model", model_version: a.p_model_version, content: a.p_content, content_hash: a.p_hash, status: "published", published_at: new Date().toISOString(), created_by_user_id: null };
    rows.push(row);
    return { data: { id: row.id, content_hash: a.p_hash }, error: null };
  },
};
const mkDb = (extra: Record<string, Row[]> = {}, options: InMemoryOptions = {}) =>
  createInMemorySupabase({ ...world(), ...extra }, { rpc: rpcHandlers, ...options });

function world(): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      { id: "ru-edit", residence_id: NORTE, user_id: "editora", role: "staff", is_active: true, permissions: permissionsFromChecked(["profile.edit"]) },
      { id: "ru-rio", residence_id: RIO, user_id: "otra", role: "owner", is_active: true },
    ],
    residence_regulation_versions: [],
    application_regulation_acceptances: [],
    residences: [{ id: NORTE }, { id: RIO }],
    audit_logs: [],
  };
}
const publish = (db: ReturnType<typeof mkDb>, userId: string, text: unknown = TEXT_A, source: unknown = "own", residenceId = NORTE) =>
  publishRegulationVersion(db.client, { actorUserId: userId, residenceId, text, source });

describe("publicar el reglamento (DR14, profile.edit, sin revisión del admin)", () => {
  it("dueño y staff con profile.edit publican; la versión nueva reemplaza a la vigente y se conserva la anterior", async () => {
    const db = mkDb();
    expect(await publish(db, "ricardo")).toEqual({ ok: true, versionNumber: 1 });
    expect(await publish(db, "editora", TEXT_B, "model")).toEqual({ ok: true, versionNumber: 2 });
    const rows = db.tables.residence_regulation_versions;
    expect(rows.map((r) => [r.version_number, r.status])).toEqual([[1, "superseded"], [2, "published"]]);
    expect(rows[1].model_version).toBeTruthy();
    expect(rows[0].content_hash).toBe(hashRegulationText(TEXT_A));
    expect(db.tables.residences.find((r) => r.id === NORTE)?.current_regulation_version_id).toBe(rows[1].id);
    expect(audits.some((a) => a.action === "residence_regulation_published" && a.actorRole)).toBe(true);
  });

  it("el staff sin profile.edit y alguien de otra residencia son rechazados y no se escribe nada", async () => {
    const db = mkDb();
    expect(await publish(db, "solo-lectura")).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
    const other = await publish(db, "otra");
    expect(other.ok).toBe(false);
    expect(db.tables.residence_regulation_versions).toHaveLength(0);
  });

  it("valida el texto en el servidor (campos sin completar, corto, source inválido) y rechaza publicar lo mismo dos veces", async () => {
    const db = mkDb();
    expect((await publish(db, "ricardo", buildModelText())).ok).toBe(false);
    expect((await publish(db, "ricardo", "corto")).ok).toBe(false);
    expect((await publish(db, "ricardo", TEXT_A, "admin")).ok).toBe(false);
    expect((await publish(db, "ricardo")).ok).toBe(true);
    const again = await publish(db, "ricardo");
    expect(again.ok).toBe(false);
    expect(db.tables.residence_regulation_versions).toHaveLength(1);
  });

  it("sin la migración 0053 avisa con claridad y no rompe", async () => {
    const db = mkDb({}, { missingTables: ["residence_regulation_versions"], rpc: {} });
    expect(await publish(db, "ricardo")).toEqual({ ok: false, error: MIGRATION_PENDING_MESSAGE });
  });
});

describe("reglamento vigente y aceptación al solicitar (DR14)", () => {
  it("sin reglamento propio rige el modelo; con la migración sin aplicar degrada al modelo", async () => {
    const db = mkDb();
    const current = await loadCurrentRegulation(db.client, NORTE);
    expect(current.ok && current.view.isBaseModel && current.view.schemaReady).toBe(true);
    const missing = mkDb({}, { missingTables: ["residence_regulation_versions"], rpc: {} });
    const degraded = await loadCurrentRegulation(missing.client, NORTE);
    expect(degraded.ok && degraded.view.isBaseModel && !degraded.view.schemaReady).toBe(true);
    expect((await listRegulationVersions(missing.client, NORTE))).toMatchObject({ ok: true, schemaReady: false });
  });

  it("rechaza si no marcó el checkbox y acepta con la versión propia vigente", async () => {
    const db = mkDb();
    await publish(db, "ricardo");
    const hash = hashRegulationText(TEXT_A);
    expect(await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: false, seenHash: hash })).toEqual({ ok: false, error: REGULATION_NOT_ACCEPTED_MESSAGE });
    const ok = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: hash });
    expect(ok.ok && ok.regulation.hash).toBe(hash);
  });

  it("si la residencia publicó otra versión mientras el estudiante leía, pide aceptar de nuevo", async () => {
    const db = mkDb();
    await publish(db, "ricardo");
    const seen = hashRegulationText(TEXT_A);
    await publish(db, "ricardo", TEXT_B);
    expect(await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: seen })).toEqual({ ok: false, error: REGULATION_CHANGED_MESSAGE });
  });

  it("sin reglamento propio la aceptación referencia una versión del modelo (una sola fila por residencia)", async () => {
    const db = mkDb();
    const base = await loadCurrentRegulation(db.client, NORTE);
    const seenHash = base.ok ? base.view.hash : "";
    const first = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash });
    const second = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash });
    expect(first.ok && second.ok && first.regulation.versionId === second.regulation.versionId).toBe(true);
    expect(db.tables.residence_regulation_versions).toHaveLength(1);
    expect(db.tables.residence_regulation_versions[0]).toMatchObject({ source: "model", status: "published" });
    // Y si después la residencia publica el suyo, el modelo base queda reemplazado y la aceptación vieja no cambia.
    if (!first.ok) return;
    await recordRegulationAcceptance(db.client, { applicationRequestId: "app-1", residenceId: NORTE, regulation: first.regulation, acceptedByUserId: "lucia", acceptedByRole: "student" });
    await publish(db, "ricardo");
    expect(db.tables.application_regulation_acceptances[0].regulation_version_id).toBe(first.regulation.versionId);
    expect(db.tables.residence_regulation_versions.map((r) => r.status)).toEqual(["superseded", "published"]);
  });

  it("guarda versión, hash, fecha y usuario; no duplica ante un reintento y audita", async () => {
    const db = mkDb();
    await publish(db, "ricardo");
    const r = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: hashRegulationText(TEXT_A) });
    if (!r.ok) throw new Error("debería resolver");
    const params = { applicationRequestId: "app-1", residenceId: NORTE, regulation: r.regulation, acceptedByUserId: "lucia", acceptedByRole: "student" as const };
    expect(await recordRegulationAcceptance(db.client, params)).toBe(true);
    const row = db.tables.application_regulation_acceptances[0];
    expect(row).toMatchObject({ application_request_id: "app-1", residence_id: NORTE, content_hash: hashRegulationText(TEXT_A), accepted_by_user_id: "lucia", accepted_by_role: "student" });
    expect(row.accepted_at).toBeTruthy();
    expect(audits.some((a) => a.action === "application_regulation_accepted" && a.actorRole === "student")).toBe(true);
  });

  it("sin la migración 0053 la solicitud no se bloquea ni se intenta guardar la aceptación; igual exige el checkbox", async () => {
    const db = mkDb({}, { missingTables: ["residence_regulation_versions", "application_regulation_acceptances"], rpc: {} });
    expect((await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: false, seenHash: null })).ok).toBe(false);
    const r = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: "lo-que-sea" });
    expect(r).toMatchObject({ ok: true, regulation: { versionId: null } });
    if (!r.ok) return;
    expect(await recordRegulationAcceptance(db.client, { applicationRequestId: "app-1", residenceId: NORTE, regulation: r.regulation, acceptedByUserId: "lucia", acceptedByRole: "student" })).toBe(true);
  });

  it("un fallo transitorio al guardar la aceptación se reintenta una vez", async () => {
    const db = mkDb({}, { failInsert: { application_regulation_acceptances: { code: "XX000", message: "boom" } } });
    await publish(db, "ricardo");
    const r = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: hashRegulationText(TEXT_A) });
    if (!r.ok) throw new Error("debería resolver");
    const ok = await recordRegulationAcceptance(db.client, { applicationRequestId: "app-2", residenceId: NORTE, regulation: r.regulation, acceptedByUserId: "lucia", acceptedByRole: "student" });
    expect(ok).toBe(true);
    expect(db.tables.application_regulation_acceptances).toHaveLength(1);
  });
});

describe("seenHash, publicación atómica y fallo al registrar (revisión DR14)", () => {
  it("con el esquema listo, sin el hash de lo que se leyó se rechaza (no se acepta «la vigente» a ciegas)", async () => {
    const db = mkDb();
    await publish(db, "ricardo");
    expect(await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: null })).toEqual({ ok: false, error: REGULATION_MISSING_HASH_MESSAGE });
    // También con el modelo base (sin versión propia).
    expect(await resolveRegulationToAccept(db.client, { residenceId: RIO, accepted: true, seenHash: null })).toEqual({ ok: false, error: REGULATION_MISSING_HASH_MESSAGE });
    expect(db.tables.residence_regulation_versions.filter((r) => r.residence_id === RIO)).toHaveLength(0);
  });

  it("si la publicación falla en la base no cambia nada, no audita y avisa sin jerga", async () => {
    const db = mkDb({}, { rpc: { ...rpcHandlers, publish_residence_regulation: () => ({ data: null, error: { code: "XX000", message: "boom en el medio" } }) } });
    audits.length = 0;
    const r = await publish(db, "ricardo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no se cambió nada");
    expect(db.tables.residence_regulation_versions).toHaveLength(0);
    expect(audits.filter((a) => a.action === "residence_regulation_published")).toHaveLength(0);
  });

  it("publicar el mismo texto que la vigente lo informa el servidor (no_changes) y la vigente sigue siendo la única", async () => {
    const db = mkDb();
    await publish(db, "ricardo");
    const again = await publish(db, "ricardo");
    expect(again).toMatchObject({ ok: false });
    expect(db.tables.residence_regulation_versions.filter((r) => r.status === "published")).toHaveLength(1);
  });

  it("la versión del modelo y la publicación propia usan la misma función serializada: lo que vio el estudiante manda", async () => {
    const db = mkDb();
    const base = await loadCurrentRegulation(db.client, NORTE);
    const seen = base.ok ? base.view.hash : "";
    await publish(db, "ricardo"); // la residencia publica el suyo mientras el estudiante leía el modelo
    expect(await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: seen })).toEqual({ ok: false, error: REGULATION_CHANGED_MESSAGE });
  });
});

const APP = "app-pend";
function pendingWorld() {
  return {
    application_requests: [{ id: APP, residence_id: NORTE, student_profile_id: "sp-adulta", status: "submitted", regulation_acceptance_pending: true }],
    student_profiles: [
      { id: "sp-adulta", user_id: "lucia", is_minor: false },
      { id: "sp-menor", user_id: "mateo", is_minor: true },
    ],
  };
}

describe("solicitudes que nacen sin aceptación: bloqueo y aceptación posterior (DR14)", () => {
  it("el gate bloquea mientras haya marca y falte la fila; las solicitudes anteriores a DR14 y las aceptadas pasan", async () => {
    const db = mkDb({ ...pendingWorld(), application_requests: [...pendingWorld().application_requests, { id: "app-vieja", residence_id: NORTE, status: "submitted" }] });
    expect(await assertRegulationAccepted(db.client, APP)).toEqual({ ok: false, error: REGULATION_PENDING_FOR_RESIDENCE_MESSAGE });
    expect((await assertRegulationAccepted(db.client, "app-vieja")).ok).toBe(true);
    db.tables.application_regulation_acceptances.push({ application_request_id: APP });
    expect((await assertRegulationAccepted(db.client, APP)).ok).toBe(true); // por la fila, aunque la marca siga en true
  });

  it("sin la migración 0053 no bloquea; ante un error de lectura real falla cerrado", async () => {
    const sinMigracion = mkDb(pendingWorld(), { missingColumns: { application_requests: ["regulation_acceptance_pending"] } });
    expect((await assertRegulationAccepted(sinMigracion.client, APP)).ok).toBe(true);
    expect(await regulationAcceptanceEnabled(sinMigracion.client)).toBe(false);
    const roto = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "XX000", message: "caído" } }) }) }) }),
    } as never;
    expect((await assertRegulationAccepted(roto, APP)).ok).toBe(false);
  });

  it("si registrar la aceptación falla tras el reintento, devuelve false y la solicitud sigue bloqueada (con auditoría)", async () => {
    const db = mkDb(pendingWorld(), { failInsert: { application_regulation_acceptances: { error: { code: "XX000", message: "boom" }, times: 2 } } });
    await publish(db, "ricardo");
    const r = await resolveRegulationToAccept(db.client, { residenceId: NORTE, accepted: true, seenHash: hashRegulationText(TEXT_A) });
    if (!r.ok) throw new Error("debería resolver");
    audits.length = 0;
    const ok = await recordRegulationAcceptance(db.client, { applicationRequestId: APP, residenceId: NORTE, regulation: r.regulation, acceptedByUserId: "lucia", acceptedByRole: "student" });
    expect(ok).toBe(false);
    expect(db.tables.application_regulation_acceptances).toHaveLength(0);
    expect((await assertRegulationAccepted(db.client, APP)).ok).toBe(false);
    expect(audits.some((a) => a.action === "application_regulation_acceptance_failed")).toBe(true);
  });

  it("aceptación posterior: el estudiante adulto acepta (role student), se levanta el bloqueo y es idempotente", async () => {
    const db = mkDb(pendingWorld());
    await publish(db, "ricardo");
    const seenHash = hashRegulationText(TEXT_A);
    expect(await acceptRegulationForApplication(db.client, { applicationId: APP, actorUserId: "lucia", accepted: false, seenHash })).toMatchObject({ ok: false });
    expect(await acceptRegulationForApplication(db.client, { applicationId: APP, actorUserId: "lucia", accepted: true, seenHash: null })).toEqual({ ok: false, error: REGULATION_MISSING_HASH_MESSAGE });
    expect(await acceptRegulationForApplication(db.client, { applicationId: APP, actorUserId: "lucia", accepted: true, seenHash })).toEqual({ ok: true });
    expect(db.tables.application_regulation_acceptances[0]).toMatchObject({ application_request_id: APP, accepted_by_user_id: "lucia", accepted_by_role: "student", content_hash: seenHash });
    expect(db.tables.application_requests.find((r) => r.id === APP)?.regulation_acceptance_pending).toBe(false);
    expect((await assertRegulationAccepted(db.client, APP)).ok).toBe(true);
    expect(await acceptRegulationForApplication(db.client, { applicationId: APP, actorUserId: "lucia", accepted: true, seenHash })).toEqual({ ok: true });
    expect(db.tables.application_regulation_acceptances).toHaveLength(1);
  });

  it("si el estudiante es menor, solo acepta su familiar vinculado (role guardian); él, otro familiar o un extraño no", async () => {
    const db = mkDb({
      ...pendingWorld(),
      application_requests: [{ id: "app-menor", residence_id: NORTE, student_profile_id: "sp-menor", status: "submitted", regulation_acceptance_pending: true }],
    });
    await publish(db, "ricardo");
    const seenHash = hashRegulationText(TEXT_A);
    const args = { applicationId: "app-menor", accepted: true, seenHash };
    expect(await acceptRegulationForApplication(db.client, { ...args, actorUserId: "mateo" })).toMatchObject({ ok: false });
    expect(await acceptRegulationForApplication(db.client, { ...args, actorUserId: "otra-familia" })).toMatchObject({ ok: false });
    expect(await acceptRegulationForApplication(db.client, { ...args, actorUserId: "martin" })).toEqual({ ok: true });
    expect(db.tables.application_regulation_acceptances[0]).toMatchObject({ accepted_by_user_id: "martin", accepted_by_role: "guardian" });
  });

  it("un familiar no puede aceptar por un estudiante mayor de edad", async () => {
    const db = mkDb(pendingWorld());
    await publish(db, "ricardo");
    const r = await acceptRegulationForApplication(db.client, { applicationId: APP, actorUserId: "martin", accepted: true, seenHash: hashRegulationText(TEXT_A) });
    expect(r.ok).toBe(false);
    expect(db.tables.application_regulation_acceptances).toHaveLength(0);
  });

  it("si el reglamento cambió mientras el estudiante lo leía, la aceptación posterior pide releerlo", async () => {
    const db = mkDb(pendingWorld());
    await publish(db, "ricardo");
    const seenHash = hashRegulationText(TEXT_A);
    await publish(db, "ricardo", TEXT_B);
    expect(await acceptRegulationForApplication(db.client, { applicationId: APP, actorUserId: "lucia", accepted: true, seenHash })).toEqual({ ok: false, error: REGULATION_CHANGED_MESSAGE });
  });
});
