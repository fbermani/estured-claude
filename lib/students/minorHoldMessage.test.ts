import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import { MINOR_ON_HOLD_LINKED_MESSAGE, MINOR_ON_HOLD_MESSAGE, minorHoldError } from "@/lib/students/minorHold";

/** Cliente falso: cada tabla devuelve sus filas, sin importar los filtros. */
function fakeAdmin(rows: { family_links: unknown[]; consents: unknown[] }): SupabaseClient {
  const birth = new Date();
  birth.setFullYear(birth.getFullYear() - 16);
  const profile = { id: "sp1", birth_date: birth.toISOString().slice(0, 10) };
  const query = (data: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      in: () => q,
      maybeSingle: async () => ({ data, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return q;
  };
  return { from: (table: string) => query(table === "student_profiles" ? profile : rows[table as keyof typeof rows]) } as unknown as SupabaseClient;
}

describe("texto del aviso de cuenta en espera (DR65 (e))", () => {
  it("sin familiar vinculado pide invitarlo", async () => {
    expect(await minorHoldError(fakeAdmin({ family_links: [], consents: [] }), "u1")).toBe(MINOR_ON_HOLD_MESSAGE);
  });

  it("con vínculo activo sin consentimiento pide el consentimiento", async () => {
    const admin = fakeAdmin({ family_links: [{ family_members: { user_id: "f1" } }], consents: [] });
    expect(await minorHoldError(admin, "u1")).toBe(MINOR_ON_HOLD_LINKED_MESSAGE);
  });

  it("con consentimiento no hay aviso", async () => {
    const admin = fakeAdmin({ family_links: [{ family_members: { user_id: "f1" } }], consents: [{ user_id: "f1" }] });
    expect(await minorHoldError(admin, "u1")).toBeNull();
  });
});
