import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ hold: null as string | null, missing: false, toggle: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/admin", () => {
  // Toda consulta (perfil, familiar, vínculo) devuelve una fila.
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: "sp1" } }) };
  return { getSupabaseAdmin: () => ({ from: () => query }) };
});
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/students/minorHold", () => ({ minorHoldError: async () => state.hold, guardianConsentMissing: async () => state.missing }));
vi.mock("@/lib/students/favorites", () => ({ toggleFavorite: state.toggle }));

import { toggleFamilyFavorite, toggleStudentFavorite } from "@/app/students/favorites/actions";

const run = () => toggleStudentFavorite("res-1", { status: "idle" }, new FormData());

describe("toggleStudentFavorite · cuenta en espera (DR65 (e))", () => {
  beforeEach(() => {
    state.hold = null;
    state.missing = false;
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

describe("toggleFamilyFavorite · consentimiento del familiar (DR65 (e))", () => {
  const runFamily = () => toggleFamilyFavorite("res-1", "sp1", { status: "idle" }, new FormData());

  beforeEach(() => {
    state.missing = false;
    state.toggle.mockReset();
    state.toggle.mockResolvedValue({ ok: true, favorited: true });
  });

  it("sin consentimiento propio no sugiere favoritos por el menor", async () => {
    state.missing = true;
    expect(await runFamily()).toEqual({ status: "error", message: "Primero dá tu consentimiento como familiar responsable desde tu panel." });
    expect(state.toggle).not.toHaveBeenCalled();
  });

  it("con consentimiento (o estudiante mayor) sugiere", async () => {
    expect(await runFamily()).toEqual({ status: "idle", favorited: true });
  });
});
