import { beforeEach, describe, expect, it, vi } from "vitest";

const getSuperadminSession = vi.fn();
const notifySuperadmins = vi.fn();
const getSupabaseAdmin = vi.fn();
const createAuditLog = vi.fn();
const loadPaymentSettings = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/requireAdmin", () => ({ getSuperadminSession: () => getSuperadminSession() }));
vi.mock("@/lib/payments/notifyPaymentSettingsChange", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments/notifyPaymentSettingsChange")>()),
  notifySuperadminsOfPaymentSettingsChange: (...a: unknown[]) => notifySuperadmins(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: (...a: unknown[]) => createAuditLog(...a) }));
vi.mock("@/lib/payments/paymentSettings", () => ({ loadPaymentSettings: (...a: unknown[]) => loadPaymentSettings(...a) }));

import { savePaymentSettings } from "@/app/admin/payment-settings/actions";

// CBU con verificadores correctos (22 ceros: entidad 000 inexistente).
const CBU = "0".repeat(22);

function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  const base = { account_holder: "EstuRed (datos de prueba)", alias: "estured.demo.cobro", cbu: CBU, bank_name: "Banco de Prueba", ...extra };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

function fakeAdmin() {
  const calls: { op: string; payload?: unknown }[] = [];
  const admin = {
    from: () => ({
      insert: (payload: unknown) => {
        calls.push({ op: "insert", payload });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-id" }, error: null }) }) };
      },
      update: (payload: unknown) => {
        calls.push({ op: "update", payload });
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  };
  return { admin, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSuperadminSession.mockResolvedValue({ id: "super-1", email: "super@example.com", roles: ["admin", "superadmin"] });
});

describe("savePaymentSettings", () => {
  it("rechaza a quien no es superadmin (un admin común tampoco) sin tocar la base ni avisar", async () => {
    getSuperadminSession.mockResolvedValue(null);
    const { admin, calls } = fakeAdmin();
    getSupabaseAdmin.mockReturnValue(admin);
    const result = await savePaymentSettings({ status: "idle" }, form());
    expect(result.status).toBe("error");
    expect(calls).toHaveLength(0);
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(notifySuperadmins).not.toHaveBeenCalled();
  });

  it("devuelve errores por campo y conserva lo tipeado cuando la validación falla", async () => {
    const { admin, calls } = fakeAdmin();
    getSupabaseAdmin.mockReturnValue(admin);
    const result = await savePaymentSettings({ status: "idle" }, form({ alias: "mal alias", cbu: "123" }));
    expect(result.status).toBe("error");
    expect(result.errors?.alias).toBeDefined();
    expect(result.errors?.cbu).toBeDefined();
    expect(result.values?.alias).toBe("mal alias");
    expect(calls).toHaveLength(0);
  });

  it("primera carga: inserta y audita sin valor anterior, con el CBU enmascarado", async () => {
    const { admin, calls } = fakeAdmin();
    getSupabaseAdmin.mockReturnValue(admin);
    loadPaymentSettings.mockResolvedValue(null);
    const result = await savePaymentSettings({ status: "idle" }, form());
    expect(result.status).toBe("saved");
    expect(result.message).toMatch(/^Datos actualizados el \d{2}\/\d{2}\/\d{4}/);
    expect(notifySuperadmins).toHaveBeenCalledWith(admin, expect.objectContaining({ isFirstLoad: true, settingsId: "new-id" }));
    expect(calls[0]).toMatchObject({ op: "insert", payload: { cbu: CBU, updated_by_user_id: "super-1" } });
    const audit = createAuditLog.mock.calls[0][1];
    expect(audit).toMatchObject({ action: "payment_settings_updated", entityId: "new-id", oldValue: null });
    expect(JSON.stringify(audit)).not.toContain(CBU);
    expect(audit.newValue.cbu).toBe("•••• 0000");
  });

  it("edición: actualiza la fila existente y audita valor anterior y nuevo enmascarados", async () => {
    const { admin, calls } = fakeAdmin();
    getSupabaseAdmin.mockReturnValue(admin);
    loadPaymentSettings.mockResolvedValue({
      id: "ps-1",
      account_holder: "Titular viejo",
      alias: "alias.viejo.1",
      cbu: "1".repeat(22),
      bank_name: "Banco viejo",
      holder_cuit: null,
      instructions: null,
      updated_by_user_id: null,
      updated_at: "2026-10-01T00:00:00Z",
    });
    const result = await savePaymentSettings({ status: "idle" }, form());
    expect(result.status).toBe("saved");
    expect(calls[0].op).toBe("update");
    const audit = createAuditLog.mock.calls[0][1];
    expect(audit.entityId).toBe("ps-1");
    const notifyArgs = notifySuperadmins.mock.calls[0][1];
    expect(notifyArgs.isFirstLoad).toBe(false);
    expect(notifyArgs.changedFields).toEqual(["account_holder", "alias", "cbu", "bank_name"]);
    expect(audit.oldValue).toMatchObject({ alias: "alias.viejo.1", cbu: "•••• 1111" });
    expect(JSON.stringify(audit)).not.toContain("1".repeat(22));
  });
});
