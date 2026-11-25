import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as { id: string } | null, hold: null as string | null, check: vi.fn(), submit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => state.user }));
vi.mock("@/lib/students/minorHold", () => ({
  minorHoldError: async (...args: unknown[]) => {
    state.check(...args);
    return state.hold;
  },
}));
vi.mock("@/lib/waitlist/hashIp", () => ({ hashIp: async () => "hash" }));
vi.mock("@/lib/faq/submitResidenceQuestion", () => ({ submitResidenceQuestion: state.submit }));

import { askResidenceQuestionAction } from "@/app/(public)/residencias/[slug]/faq-actions";

function run() {
  const f = new FormData();
  f.set("question", "¿Se pueden recibir visitas?");
  return askResidenceQuestionAction("res-1", { status: "idle" }, f);
}

describe("askResidenceQuestionAction · cuenta en espera (DR65 (e))", () => {
  beforeEach(() => {
    state.user = { id: "u1" };
    state.hold = null;
    state.check.mockReset();
    state.submit.mockReset();
    state.submit.mockResolvedValue({ ok: true, questionId: "q1" });
  });

  it("un menor en espera no envía la pregunta", async () => {
    state.hold = "Tu cuenta está en espera";
    expect(await run()).toEqual({ status: "error", message: "Tu cuenta está en espera" });
    expect(state.submit).not.toHaveBeenCalled();
  });

  it("con sesión sin espera, envía", async () => {
    expect((await run()).status).toBe("sent");
  });

  it("sin sesión no consulta la espera y envía", async () => {
    state.user = null;
    expect((await run()).status).toBe("sent");
    expect(state.check).not.toHaveBeenCalled();
  });
});
