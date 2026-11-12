import { beforeEach, describe, expect, it, vi } from "vitest";

/** Frenos de la preapertura sobre el rate limit persistente (M6): umbrales, claves normalizadas y corte temprano. */
vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  blockedBuckets: new Set<string>(),
  calls: [] as Array<{ bucket: string; key: string; windowSeconds: number; max: number }>,
}));
vi.mock("@/lib/security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/rateLimit")>()),
  consumeRateLimit: async (opts: { bucket: string; key: string; windowSeconds: number; max: number }) => {
    state.calls.push(opts);
    return { ok: !state.blockedBuckets.has(opts.bucket) };
  },
}));

import { familyInviteMailAllowed, profileSaveAllowed, signupAllowed } from "@/lib/preapertura/throttle";

const headers = new Headers({ "x-real-ip": "203.0.113.5" });

beforeEach(() => {
  state.blockedBuckets = new Set();
  state.calls = [];
});

describe("throttle de preapertura (persistente)", () => {
  it("alta: 15/h por IP y 6/h por email normalizado", async () => {
    expect(await signupAllowed(headers, " Ana@Mail.com")).toBe(true);
    expect(state.calls).toEqual([
      { bucket: "preap_signup_ip", key: "203.0.113.5", windowSeconds: 3600, max: 15 },
      { bucket: "preap_signup_email", key: "ana@mail.com", windowSeconds: 3600, max: 6 },
    ]);
  });

  it("alta: si corta por IP no consume el límite por email", async () => {
    state.blockedBuckets.add("preap_signup_ip");
    expect(await signupAllowed(headers, "ana@mail.com")).toBe(false);
    expect(state.calls.map((c) => c.bucket)).toEqual(["preap_signup_ip"]);
  });

  it("perfil: 60/h por usuario", async () => {
    expect(await profileSaveAllowed("user-1")).toBe(true);
    expect(state.calls).toEqual([{ bucket: "preap_profile_user", key: "user-1", windowSeconds: 3600, max: 60 }]);
  });

  it("mail de invitación: 3 por día por destinatario", async () => {
    expect(await familyInviteMailAllowed("Hijo@Mail.com ")).toBe(true);
    expect(state.calls).toEqual([{ bucket: "preap_invite_mail_to", key: "hijo@mail.com", windowSeconds: 86400, max: 3 }]);
    state.blockedBuckets.add("preap_invite_mail_to");
    expect(await familyInviteMailAllowed("hijo@mail.com")).toBe(false);
  });
});
