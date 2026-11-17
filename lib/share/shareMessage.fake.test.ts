import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorRole: string; action: string; newValue?: unknown }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => {
    audits.push(e);
    return true;
  },
}));
const dataState = vi.hoisted(() => ({ values: null as Record<string, string | null> | null }));
vi.mock("@/lib/share/shareData", () => ({
  loadShareData: async () =>
    dataState.values
      ? { residenceName: "Norte", slug: "norte", link: "https://estured.vercel.app/r/norte", published: true, values: dataState.values }
      : null,
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import { DEFAULT_SHARE_TEMPLATE, SHARE_TEMPLATE_MAX } from "@/lib/share/resolveShareMessage";
import { SHARE_MIGRATION_PENDING_MESSAGE, loadShareTemplate, resetShareTemplate, saveShareTemplate } from "@/lib/share/shareMessage";

const NORTE = "res-norte";
const OTRA = "res-otra";
const VALUES = {
  LINK: "https://estured.vercel.app/r/norte",
  PRICE_FROM: "190",
  PRICE_FROM_ARS: "281.000",
  ZONE: "Palermo",
  UNIVERSITY: "UP",
  STAY_CONDITIONS: "Estadía mínima de 6 meses",
};

function world(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      { id: "ru-perfil", residence_id: NORTE, user_id: "perfil-staff", role: "staff", is_active: true, permissions: permissionsFromChecked(["profile.edit"]) },
      { id: "ru-otro", residence_id: OTRA, user_id: "otro-dueno", role: "owner", is_active: true },
    ],
    residence_share_messages: [],
    ...extra,
  };
}
type Db = ReturnType<typeof createInMemorySupabase>;
const asAdmin = (db: Db) => db.client as never;
const save = (db: Db, template: unknown, actor = "ricardo", residenceId = NORTE) =>
  saveShareTemplate(asAdmin(db), { actorUserId: actor, residenceId, template });

beforeEach(() => {
  audits.length = 0;
  dataState.values = { ...VALUES };
});

describe("loadShareTemplate", () => {
  it("sin fila usa el original", async () => {
    const db = createInMemorySupabase(world());
    expect(await loadShareTemplate(asAdmin(db), NORTE)).toEqual({ template: DEFAULT_SHARE_TEMPLATE, isCustom: false, schemaReady: true });
  });
  it("con fila usa la de la residencia, y nunca la de otra", async () => {
    const db = createInMemorySupabase(world({ residence_share_messages: [{ residence_id: OTRA, template: "Otra {LINK}" }, { residence_id: NORTE, template: "Mía {LINK}" }] }));
    expect(await loadShareTemplate(asAdmin(db), NORTE)).toMatchObject({ template: "Mía {LINK}", isCustom: true });
  });
  it("sin la migración 0095 comparte el original y avisa que no se puede guardar", async () => {
    const db = createInMemorySupabase(world(), { missingTables: ["residence_share_messages"] });
    expect(await loadShareTemplate(asAdmin(db), NORTE)).toEqual({ template: DEFAULT_SHARE_TEMPLATE, isCustom: false, schemaReady: false });
  });
});

describe("saveShareTemplate: permisos", () => {
  it("el dueño guarda y queda auditado", async () => {
    const db = createInMemorySupabase(world());
    const r = await save(db, "Hola, mirá: {LINK}");
    expect(r).toEqual({ ok: true, message: "Hola, mirá: {LINK}" });
    expect(db.tables.residence_share_messages).toHaveLength(1);
    expect(db.tables.residence_share_messages[0]).toMatchObject({ residence_id: NORTE, template: "Hola, mirá: {LINK}", updated_by_user_id: "ricardo" });
    expect(audits[0]).toMatchObject({ action: "residence_share_message_saved", actorRole: "residence_owner" });
  });
  it("el staff con permiso de perfil también", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, "Hola {LINK}", "perfil-staff")).ok).toBe(true);
    expect(audits[0].actorRole).toBe("residence_staff");
  });
  it("el staff sin permiso de perfil NO guarda (solo ve y comparte)", async () => {
    const db = createInMemorySupabase(world());
    const r = await save(db, "Hola {LINK}", "solo-lectura");
    expect(r).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
    expect(db.tables.residence_share_messages).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });
  it("quien no es de la residencia no guarda, ni siquiera siendo dueño de otra", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, "Hola {LINK}", "otro-dueno")).ok).toBe(false);
    expect((await save(db, "Hola {LINK}", "desconocido")).ok).toBe(false);
    expect(db.tables.residence_share_messages).toHaveLength(0);
  });
});

describe("saveShareTemplate: validación server-side", () => {
  it.each([
    ["vacío", "   "],
    ["sin {LINK}", "Hola, mirá nuestra ficha"],
    ["placeholder desconocido", "Hola {LINK} {NOMBRE}"],
    ["llave suelta", "Hola {LINK} {"],
    ["US$", "Desde US$ 100 {LINK}"],
    ["más de 1.000 caracteres", `{LINK} ${"a".repeat(SHARE_TEMPLATE_MAX)}`],
    ["no es texto", { template: "{LINK}" }],
  ])("rechaza: %s", async (_name, template) => {
    const db = createInMemorySupabase(world());
    const r = await save(db, template);
    expect(r.ok).toBe(false);
    expect(db.tables.residence_share_messages).toHaveLength(0);
  });

  it("también valida el texto ya resuelto con los datos reales", async () => {
    // La plantilla cruda entra (≤ 1.000), pero al resolver los datos se pasa.
    dataState.values = { ...VALUES, STAY_CONDITIONS: "x".repeat(500) };
    const db = createInMemorySupabase(world());
    const template = `{LINK}\n${"a".repeat(500)}\n{STAY_CONDITIONS}`;
    expect(template.length).toBeLessThanOrEqual(SHARE_TEMPLATE_MAX);
    const r = await save(db, template);
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/caracteres/);
  });

  it("si no se pueden leer los datos de la residencia, no guarda", async () => {
    dataState.values = null;
    const db = createInMemorySupabase(world());
    expect((await save(db, "Hola {LINK}")).ok).toBe(false);
    expect(db.tables.residence_share_messages).toHaveLength(0);
  });

  it("guardar de nuevo reemplaza (una fila por residencia)", async () => {
    const db = createInMemorySupabase(world());
    await save(db, "Uno {LINK}");
    await save(db, "Dos {LINK}");
    expect(db.tables.residence_share_messages).toHaveLength(1);
    expect(db.tables.residence_share_messages[0].template).toBe("Dos {LINK}");
  });

  it("guardar el texto original borra la fila (vuelve a «usando el original»)", async () => {
    const db = createInMemorySupabase(world({ residence_share_messages: [{ residence_id: NORTE, template: "Mía {LINK}" }] }));
    expect((await save(db, DEFAULT_SHARE_TEMPLATE)).ok).toBe(true);
    expect(db.tables.residence_share_messages).toHaveLength(0);
  });

  it("sin la migración 0095 avisa en español en vez de fallar", async () => {
    const db = createInMemorySupabase(world(), { missingTables: ["residence_share_messages"] });
    expect(await save(db, "Hola {LINK}")).toEqual({ ok: false, error: SHARE_MIGRATION_PENDING_MESSAGE });
  });
});

describe("resetShareTemplate", () => {
  it("borra solo la fila de ESA residencia y deja auditoría", async () => {
    const db = createInMemorySupabase(
      world({ residence_share_messages: [{ residence_id: NORTE, template: "Mía {LINK}" }, { residence_id: OTRA, template: "Otra {LINK}" }] }),
    );
    const r = await resetShareTemplate(asAdmin(db), { actorUserId: "ricardo", residenceId: NORTE });
    expect(r).toEqual({ ok: true, message: DEFAULT_SHARE_TEMPLATE });
    expect(db.tables.residence_share_messages.map((m) => m.residence_id)).toEqual([OTRA]);
    expect(audits[0]).toMatchObject({ action: "residence_share_message_reset" });
  });
  it("el staff sin permiso de perfil no restablece", async () => {
    const db = createInMemorySupabase(world({ residence_share_messages: [{ residence_id: NORTE, template: "Mía {LINK}" }] }));
    expect(await resetShareTemplate(asAdmin(db), { actorUserId: "solo-lectura", residenceId: NORTE })).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
    expect(db.tables.residence_share_messages).toHaveLength(1);
  });
  it("es idempotente y sin la 0095 ya se usa el original", async () => {
    const db = createInMemorySupabase(world());
    expect((await resetShareTemplate(asAdmin(db), { actorUserId: "ricardo", residenceId: NORTE })).ok).toBe(true);
    const missing = createInMemorySupabase(world(), { missingTables: ["residence_share_messages"] });
    expect((await resetShareTemplate(asAdmin(missing), { actorUserId: "ricardo", residenceId: NORTE })).ok).toBe(true);
  });
});
