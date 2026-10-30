import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ redirected: null as string | null, link: vi.fn(), missing: vi.fn(), activate: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirected = to;
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => ({ auth: { signInWithPassword: async () => ({}) } }) }));
vi.mock("@/lib/residents/linkRequestsStudent", () => ({ submitLinkRequest: state.link, submitMissingResidence: state.missing }));
vi.mock("@/lib/residents/activateResidentStay", () => ({ activateResidentStay: state.activate }));
vi.mock("@/lib/residents/inviteVerification", () => ({
  otpRequiredFor: () => false,
  resolveInviteByToken: async () => ({ ok: true, invite: { channel: "email", otp_verified_at: null }, stay: { invite_email: "x@y.com" } }),
}));
vi.mock("@/lib/residents/inviteThrottle", () => ({ INVITE_TOO_MANY_ATTEMPTS: "x", inviteAttemptAllowed: () => true }));
const inserted = vi.hoisted(() => ({ creates: 0 }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { createUser: async () => { inserted.creates++; return { data: { user: { id: "u1" } }, error: null }; }, deleteUser: async () => ({}) } },
    from: () => ({ insert: () => Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => ({ data: { id: "sp1" }, error: null }) }) }) }),
  }),
}));

import { registerStudent } from "@/app/(public)/register/student/actions";

function form(extra: Record<string, string>) {
  const f = new FormData();
  const base: Record<string, string> = { first_name: "Ana", last_name: "Paz", birth_date: "2000-01-01", email: "ana@mail.com", phone: "+54 11 5555 1234", password: "Clave-segura-123", accept_terms: "on", accept_privacy: "on", ...extra };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}
async function run(extra: Record<string, string>) {
  try {
    return await registerStudent({ status: "idle" }, form(extra));
  } catch (e) {
    if ((e as Error).message !== "NEXT_REDIRECT") throw e;
    return null;
  }
}

describe("registerStudent · bloque «Ya vivo en una residencia» (DR21)", () => {
  beforeEach(() => {
    state.redirected = null;
    inserted.creates = 0;
    state.link.mockReset();
    state.missing.mockReset();
    state.activate.mockReset();
  });

  it("con residencia de la lista pide el vínculo y va a Mi residencia", async () => {
    state.link.mockResolvedValue({ ok: true, residenceName: "Casa Sur" });
    await run({ link_residence_id: "res-1" });
    expect(state.link).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorUserId: "u1", residenceId: "res-1" }));
    expect(state.redirected).toBe("/students/residency");
  });

  it("con nombre libre registra el pedido de residencia faltante", async () => {
    state.missing.mockResolvedValue({ ok: true });
    await run({ missing_residence_name: "Casa Norte" });
    expect(state.missing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ residenceName: "Casa Norte" }));
    expect(state.redirected).toBe("/students/residency");
  });

  it("ambos campos a la vez: error y no crea la cuenta", async () => {
    const r = await run({ link_residence_id: "res-1", missing_residence_name: "Casa Norte" });
    expect(r?.status).toBe("error");
    expect(inserted.creates).toBe(0);
  });

  it("un fallo del aviso no bloquea el alta y avisa en el destino", async () => {
    state.link.mockResolvedValue({ ok: false, error: "x" });
    await run({ link_residence_id: "res-1" });
    expect(inserted.creates).toBe(1);
    expect(state.redirected).toBe("/students/residency?aviso=error");
    state.missing.mockRejectedValue(new Error("boom"));
    await run({ missing_residence_name: "Casa Norte" });
    expect(state.redirected).toBe("/students/residency?aviso=error");
  });

  it("con invitación ignora el bloque", async () => {
    state.activate.mockResolvedValue({ ok: true });
    await run({ invite: "tok", link_residence_id: "res-1", missing_residence_name: "X" });
    expect(state.link).not.toHaveBeenCalled();
    expect(state.missing).not.toHaveBeenCalled();
    expect(state.redirected).toBe("/students/residency");
  });
});
