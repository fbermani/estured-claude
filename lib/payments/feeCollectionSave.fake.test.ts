import { beforeEach, describe, expect, it, vi } from "vitest";

type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; entityType: string; oldValue?: unknown; newValue?: unknown };
const audits = vi.hoisted(() => [] as AuditEntry[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
}));
const notices = vi.hoisted(() => [] as { entityId: string | null; changes: string[] }[]);
vi.mock("@/lib/payments/notifyFeeCollectionChange", () => ({
  notifySuperadminsOfFeeCollectionChange: async (_a: unknown, p: { entityId: string | null; changes: string[] }) => void notices.push(p),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { importFeeCollectionFromSettingsCore, saveFeeCollectionMethodCore } from "@/lib/payments/feeCollectionSave";

/** DR64 (a): configuración de los medios de cobro del fee. Solo superadmin; auditoría enmascarada; aviso sin datos. */
const CBU = "0000003100012345678901";
const SETTINGS: Row = { id: "s1", account_holder: "EstuRed SAS", alias: "estured.demo", cbu: CBU, bank_name: "Banco X", holder_cuit: null, instructions: null, updated_by_user_id: null, updated_at: "2026-11-20T00:00:00Z" };

function world(over: { methods?: Row[]; settings?: Row[]; roles?: Row[] } = {}): Record<string, Row[]> {
  return {
    user_roles: over.roles ?? [
      { user_id: "u-super", role: "superadmin", is_active: true },
      { user_id: "u-admin", role: "admin", is_active: true },
    ],
    estured_fee_collection_methods: over.methods ?? [],
    payment_settings: over.settings ?? [SETTINGS],
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const methods = () => fake.tables.estured_fee_collection_methods;
const writes = () => fake.log.filter((l) => l.op !== "select");
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};
const input = (over: Partial<Parameters<typeof saveFeeCollectionMethodCore>[1]> = {}) => ({
  actorUserId: "u-super",
  methodKey: "transfer_ars",
  details: `CBU ${CBU} alias estured.cobro`,
  currency: "ARS",
  isEnabled: true,
  ...over,
});

beforeEach(() => {
  audits.length = 0;
  notices.length = 0;
  boot();
});

describe("saveFeeCollectionMethodCore", () => {
  it("el superadmin crea un medio: auditoría enmascarada y aviso sin datos de cobro", async () => {
    const res = await saveFeeCollectionMethodCore(fake.client, input());
    expect(res).toEqual({ ok: true, changed: true });
    expect(methods()).toHaveLength(1);
    expect(methods()[0]).toMatchObject({ method_key: "transfer_ars", method_label: null, currency: "ARS", is_enabled: true, updated_by_user_id: "u-super" });
    expect(audits[0]).toMatchObject({ action: "estured_fee_collection_method_updated", actorRole: "superadmin", entityType: "estured_fee_collection_methods", oldValue: null });
    expect(JSON.stringify(audits)).not.toContain(CBU);
    expect(JSON.stringify(audits)).toContain("•••• ");
    expect(notices).toHaveLength(1);
    expect(JSON.stringify(notices)).not.toContain(CBU);
  });

  it("un admin común (sin superadmin) y un usuario sin rol no escriben nada", async () => {
    for (const actorUserId of ["u-admin", "u-nadie"]) {
      expect(await saveFeeCollectionMethodCore(fake.client, input({ actorUserId }))).toEqual({ ok: false, error: "Solo un superadmin puede modificar los medios de cobro del fee." });
    }
    expect(writes()).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it("un superadmin con el rol inactivo no escribe", async () => {
    boot(world({ roles: [{ user_id: "u-super", role: "superadmin", is_active: false }] }));
    expect(await saveFeeCollectionMethodCore(fake.client, input())).toMatchObject({ ok: false });
    expect(writes()).toHaveLength(0);
  });

  it("valida clave del catálogo, moneda y datos", async () => {
    expect(await saveFeeCollectionMethodCore(fake.client, input({ methodKey: "bitcoin" }))).toMatchObject({ ok: false });
    expect(await saveFeeCollectionMethodCore(fake.client, input({ currency: "EUR" }))).toMatchObject({ ok: false, error: expect.stringContaining("moneda") });
    expect(await saveFeeCollectionMethodCore(fake.client, input({ details: "  " }))).toMatchObject({ ok: false });
    expect(await saveFeeCollectionMethodCore(fake.client, input({ details: "x".repeat(501) }))).toMatchObject({ ok: false });
    expect(writes()).toHaveLength(0);
  });

  it("«Otro» exige nombre; el resto guarda method_label en null aunque llegue uno", async () => {
    expect(await saveFeeCollectionMethodCore(fake.client, input({ methodKey: "other", label: "" }))).toMatchObject({ ok: false });
    expect((await saveFeeCollectionMethodCore(fake.client, input({ methodKey: "other", label: "Cripto" }))).ok).toBe(true);
    expect((await saveFeeCollectionMethodCore(fake.client, input({ methodKey: "belo", label: "Hackeo", details: "belo.estured" }))).ok).toBe(true);
    expect(methods().find((m) => m.method_key === "other")?.method_label).toBe("Cripto");
    expect(methods().find((m) => m.method_key === "belo")?.method_label).toBeNull();
  });

  it("editar un medio existente actualiza la fila; sin cambios no audita ni avisa", async () => {
    await saveFeeCollectionMethodCore(fake.client, input());
    audits.length = 0;
    notices.length = 0;
    const same = await saveFeeCollectionMethodCore(fake.client, input());
    expect(same).toEqual({ ok: true, changed: false });
    expect(audits).toHaveLength(0);
    expect(notices).toHaveLength(0);

    const off = await saveFeeCollectionMethodCore(fake.client, input({ isEnabled: false, details: "" }));
    expect(off).toEqual({ ok: true, changed: true });
    expect(methods()).toHaveLength(1);
    expect(methods()[0]).toMatchObject({ is_enabled: false, details: `CBU ${CBU} alias estured.cobro` });
    expect(notices[0].changes).toEqual(["Se deshabilitó «Transferencia en pesos»."]);
    expect(audits[0].oldValue).toMatchObject({ is_enabled: true });
  });
});

describe("importFeeCollectionFromSettingsCore", () => {
  it("crea «Transferencia en pesos» habilitada desde payment_settings, sin que el CBU salga en auditoría ni aviso", async () => {
    const res = await importFeeCollectionFromSettingsCore(fake.client, { actorUserId: "u-super" });
    expect(res).toEqual({ ok: true, changed: true });
    expect(methods()[0]).toMatchObject({ method_key: "transfer_ars", currency: "ARS", is_enabled: true });
    expect(String(methods()[0].details)).toContain(CBU);
    expect(audits[0]).toMatchObject({ action: "estured_fee_collection_method_imported" });
    expect(JSON.stringify(audits)).not.toContain(CBU);
    expect(JSON.stringify(notices)).not.toContain(CBU);
  });

  it("solo superadmin, una sola vez y con cuenta cargada", async () => {
    expect(await importFeeCollectionFromSettingsCore(fake.client, { actorUserId: "u-admin" })).toMatchObject({ ok: false });
    expect(writes()).toHaveLength(0);
    boot(world({ settings: [] }));
    expect(await importFeeCollectionFromSettingsCore(fake.client, { actorUserId: "u-super" })).toMatchObject({ ok: false, error: expect.stringContaining("No hay una cuenta") });
    boot();
    await importFeeCollectionFromSettingsCore(fake.client, { actorUserId: "u-super" });
    expect(await importFeeCollectionFromSettingsCore(fake.client, { actorUserId: "u-super" })).toMatchObject({ ok: false, error: expect.stringContaining("ya está cargada") });
    expect(methods()).toHaveLength(1);
  });

  it("si el texto no entra en 500 caracteres no lo recorta: pide cargarlo a mano", async () => {
    boot(world({ settings: [{ ...SETTINGS, instructions: "i".repeat(500) }] }));
    const res = await importFeeCollectionFromSettingsCore(fake.client, { actorUserId: "u-super" });
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining("500 caracteres") });
    expect(methods()).toHaveLength(0);
  });
});
