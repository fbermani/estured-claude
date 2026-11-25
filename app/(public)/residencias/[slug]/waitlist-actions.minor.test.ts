import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ hold: null as string | null, join: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/students/minorHold", () => ({ minorHoldError: async () => state.hold }));
vi.mock("@/lib/waitlist-entries/joinWaitlist", () => ({ joinWaitlist: state.join }));

import { joinWaitlistAction } from "@/app/(public)/residencias/[slug]/waitlist-actions";

function form() {
  const f = new FormData();
  f.set("desired_start_date", "any");
  return f;
}

describe("joinWaitlistAction · cuenta en espera (DR65 (e))", () => {
  beforeEach(() => {
    state.hold = null;
    state.join.mockReset();
    state.join.mockResolvedValue({ ok: true });
  });

  it("un menor en espera no se suma a la lista", async () => {
    state.hold = "Tu cuenta está en espera";
    const r = await joinWaitlistAction("res-1", { status: "idle" }, form());
    expect(r).toEqual({ status: "error", message: "Tu cuenta está en espera" });
    expect(state.join).not.toHaveBeenCalled();
  });

  it("sin espera, se suma", async () => {
    const r = await joinWaitlistAction("res-1", { status: "idle" }, form());
    expect(r.status).toBe("saved");
    expect(state.join).toHaveBeenCalledTimes(1);
  });
});
