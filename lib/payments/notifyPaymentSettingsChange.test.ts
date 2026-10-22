import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const createNotification = vi.fn();
const sendEmail = vi.fn();
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import {
  changedPaymentSettingsFields,
  notifySuperadminsOfPaymentSettingsChange,
} from "@/lib/payments/notifyPaymentSettingsChange";

function fakeAdmin() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      if (table === "user_roles") {
        chain.then = (resolve: (v: unknown) => unknown) =>
          resolve({ data: [{ user_id: "s1" }, { user_id: "s2" }, { user_id: "s3" }] });
      }
      chain.in = () =>
        Promise.resolve({
          data: [
            { id: "s1", email: "uno@example.com", is_active: true, is_blocked: false },
            { id: "s2", email: "dos@example.com", is_active: true, is_blocked: false },
            { id: "s3", email: "bloqueado@example.com", is_active: true, is_blocked: true },
          ],
        });
      return chain;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => vi.clearAllMocks());

describe("changedPaymentSettingsFields", () => {
  const before = { account_holder: "A", alias: "alias.uno.x", cbu: "1", bank_name: "B", holder_cuit: null, instructions: null };
  it("devuelve solo los campos que cambiaron", () => {
    expect(changedPaymentSettingsFields(before, { ...before, alias: "alias.dos.x" })).toEqual(["alias"]);
    expect(changedPaymentSettingsFields(before, { ...before, holder_cuit: "20123456786", instructions: "hola" })).toEqual([
      "holder_cuit",
      "instructions",
    ]);
  });
  it("en la primera carga son todos", () => {
    expect(changedPaymentSettingsFields(null, before)).toHaveLength(6);
  });
});

describe("notifySuperadminsOfPaymentSettingsChange", () => {
  it("notifica in-app con enlace por tipo y manda email a cada superadmin activo (no a los bloqueados)", async () => {
    await notifySuperadminsOfPaymentSettingsChange(fakeAdmin(), {
      settingsId: "ps-1",
      editorEmail: "super@example.com",
      changedFields: ["alias", "cbu"],
      isFirstLoad: false,
    });
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification.mock.calls[0][1]).toMatchObject({
      userId: "s1",
      relatedEntityType: "payment_settings",
      relatedEntityId: "ps-1",
    });
    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(["uno@example.com", "dos@example.com"]);
  });

  it("el email no lleva CBU, alias, titular ni quién editó; solo qué campos cambiaron", async () => {
    await notifySuperadminsOfPaymentSettingsChange(fakeAdmin(), {
      settingsId: "ps-1",
      editorEmail: "super@example.com",
      changedFields: ["alias", "cbu"],
      isFirstLoad: false,
    });
    const { html, subject } = sendEmail.mock.calls[0][0];
    expect(html).toContain("alias, CBU");
    expect(html + subject).not.toContain("super@example.com");
    expect(html).not.toMatch(/\d{10,}/);
  });

  it("nunca lanza aunque falle la lectura", async () => {
    const broken = { from: () => { throw new Error("boom"); } } as unknown as SupabaseClient;
    await expect(
      notifySuperadminsOfPaymentSettingsChange(broken, { settingsId: null, editorEmail: "x@y.z", changedFields: [], isFirstLoad: true }),
    ).resolves.toBeUndefined();
  });
});
