import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const createNotification = vi.fn();
const sendEmail = vi.fn();
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { notifySuperadminsOfFeeCollectionChange } from "@/lib/payments/notifyFeeCollectionChange";

function fakeAdmin() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      if (table === "user_roles") chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [{ user_id: "s1" }] });
      chain.in = () => Promise.resolve({ data: [{ id: "s1", email: "uno@example.com", is_active: true, is_blocked: false }] });
      return chain;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => vi.clearAllMocks());

describe("notifySuperadminsOfFeeCollectionChange", () => {
  it("escapa el HTML del email (el nombre de «Otro» lo escribe un superadmin) y deja el texto plano en la notificación", async () => {
    const label = `Se cargó «<img src=x onerror=alert(1)>».`;
    await notifySuperadminsOfFeeCollectionChange(fakeAdmin(), { entityId: "m1", changes: [label] });
    const html = String(sendEmail.mock.calls[0][0].html);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(createNotification.mock.calls[0][1].body).toContain("<img");
  });

  it("sin cambios no avisa", async () => {
    await notifySuperadminsOfFeeCollectionChange(fakeAdmin(), { entityId: null, changes: [] });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
