import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ hold: null as string | null, toggle: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "sp1" } }) }) }) }) }),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/students/minorHold", () => ({ minorHoldError: async () => state.hold }));
vi.mock("@/lib/students/favorites", () => ({ toggleFavorite: state.toggle }));

import { toggleStudentFavorite } from "@/app/students/favorites/actions";

const run = () => toggleStudentFavorite("res-1", { status: "idle" }, new FormData());

describe("toggleStudentFavorite · cuenta en espera (DR65 (e))", () => {
  beforeEach(() => {
    state.hold = null;
    state.toggle.mockReset();
    state.toggle.mockResolvedValue({ ok: true, favorited: true });
  });

  it("un menor en espera no guarda favoritos", async () => {
    state.hold = "Tu cuenta está en espera";
    expect(await run()).toEqual({ status: "error", message: "Tu cuenta está en espera" });
    expect(state.toggle).not.toHaveBeenCalled();
  });

  it("sin espera, guarda", async () => {
    expect(await run()).toEqual({ status: "idle", favorited: true });
  });
});
