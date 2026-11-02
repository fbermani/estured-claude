import { beforeEach, describe, expect, it, vi } from "vitest";

/** DR29 — `toggleChecklistItemAction` con un cliente Supabase falso: dueño, catálogo, estado y degradación sin migración. */
const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  reservation: { id: "11111111-1111-4111-8111-111111111111", status: "confirmed", student_profiles: { user_id: "user-1" } } as Record<string, unknown> | null,
  writeError: null as { code?: string } | null,
  upserts: [] as Record<string, unknown>[],
  deletes: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      if (table === "reservations") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.reservation, error: null }) }) }) };
      if (table === "arrival_checklist_items") {
        return {
          upsert: async (row: Record<string, unknown>) => {
            if (state.writeError) return { error: state.writeError };
            state.upserts.push(row);
            return { error: null };
          },
          delete: () => ({
            eq: (_c: string, rid: string) => ({
              eq: async (_k: string, key: string) => {
                if (state.writeError) return { error: state.writeError };
                state.deletes.push({ rid, key });
                return { error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  }),
}));

import { toggleChecklistItemAction } from "@/app/students/dashboard/arrivalActions";

const RID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  state.user = { id: "user-1" };
  state.reservation = { id: RID, status: "confirmed", student_profiles: { user_id: "user-1" } };
  state.writeError = null;
  state.upserts = [];
  state.deletes = [];
});

describe("toggleChecklistItemAction", () => {
  it("tilda un ítem del catálogo", async () => {
    const r = await toggleChecklistItemAction({ reservationId: RID, itemKey: "doc.identidad", checked: true });
    expect(r.ok).toBe(true);
    expect(state.upserts).toEqual([{ reservation_id: RID, item_key: "doc.identidad", checked_by: "user-1" }]);
  });
  it("destilda borrando la fila", async () => {
    const r = await toggleChecklistItemAction({ reservationId: RID, itemKey: "doc.identidad", checked: false });
    expect(r.ok).toBe(true);
    expect(state.deletes).toEqual([{ rid: RID, key: "doc.identidad" }]);
  });
  it("rechaza sin sesión, ítem fuera del catálogo y reserva ajena", async () => {
    state.user = null;
    expect((await toggleChecklistItemAction({ reservationId: RID, itemKey: "doc.identidad", checked: true })).ok).toBe(false);
    state.user = { id: "user-1" };
    expect((await toggleChecklistItemAction({ reservationId: RID, itemKey: "inventado", checked: true })).ok).toBe(false);
    state.reservation = { id: RID, status: "confirmed", student_profiles: { user_id: "otro" } };
    expect((await toggleChecklistItemAction({ reservationId: RID, itemKey: "doc.identidad", checked: true })).ok).toBe(false);
    expect(state.upserts).toHaveLength(0);
  });
  it("rechaza una reserva en estado no permitido", async () => {
    state.reservation = { id: RID, status: "pending_estured_fee", student_profiles: { user_id: "user-1" } };
    expect((await toggleChecklistItemAction({ reservationId: RID, itemKey: "doc.identidad", checked: true })).ok).toBe(false);
  });
  it("sin migración aplicada devuelve un mensaje claro", async () => {
    state.writeError = { code: "PGRST205" };
    const r = await toggleChecklistItemAction({ reservationId: RID, itemKey: "doc.identidad", checked: true });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.message).toContain("todavía no está disponible");
  });
});
