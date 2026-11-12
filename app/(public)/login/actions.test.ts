import { beforeEach, describe, expect, it, vi } from "vitest";

/** M6 — `signIn`: consulta los límites antes (sin consumir) y consume solo en intentos fallidos; si corta, no llama a Supabase Auth. */
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "198.51.100.9" }) }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => null, roleHome: () => "/" }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null }));

const state = vi.hoisted(() => ({
  blockedBuckets: new Set<string>(),
  consumeCalls: [] as Array<{ bucket: string; key: string; windowSeconds: number; max: number }>,
  peekBuckets: [] as string[],
  signInCalls: 0,
}));
vi.mock("@/lib/security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/rateLimit")>()),
  isRateLimited: async (opts: { bucket: string }) => {
    state.peekBuckets.push(opts.bucket);
    return state.blockedBuckets.has(opts.bucket);
  },
  consumeRateLimit: async (opts: { bucket: string; key: string; windowSeconds: number; max: number }) => {
    state.consumeCalls.push(opts);
    return { ok: true };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({
    auth: {
      signInWithPassword: async () => {
        state.signInCalls++;
        return { data: { user: null }, error: { message: "Invalid login credentials" } };
      },
      signOut: async () => ({}),
    },
  }),
}));

import { signIn } from "@/app/(public)/login/actions";

function form(email: string): FormData {
  const f = new FormData();
  f.set("email", email);
  f.set("password", "lo-que-sea");
  return f;
}

beforeEach(() => {
  state.blockedBuckets = new Set();
  state.consumeCalls = [];
  state.peekBuckets = [];
  state.signInCalls = 0;
});

describe("signIn · rate limit (M6)", () => {
  it("consulta los tres límites antes y consume solo al fallar, con IP 50, IP+email 5 y email 20 cada 15 min", async () => {
    const r = await signIn({ status: "idle" }, form("  Ana@Mail.com "));
    expect(r).toEqual({ status: "error", message: "Email o contraseña incorrectos." });
    expect(state.peekBuckets).toEqual(["login_ip", "login_ip_email", "login_email"]);
    expect(state.consumeCalls).toEqual([
      { bucket: "login_ip", key: "198.51.100.9", windowSeconds: 900, max: 50 },
      { bucket: "login_ip_email", key: "198.51.100.9|ana@mail.com", windowSeconds: 900, max: 5 },
      { bucket: "login_email", key: "ana@mail.com", windowSeconds: 900, max: 20 },
    ]);
    expect(state.signInCalls).toBe(1);
  });

  it.each(["login_ip", "login_ip_email", "login_email"])(
    "si %s está bloqueado: mensaje neutro, sin consumir ni llamar a Supabase",
    async (bucket) => {
      state.blockedBuckets.add(bucket);
      const r = await signIn({ status: "idle" }, form("ana@mail.com"));
      expect(r.status).toBe("error");
      expect(r.message).toMatch(/muchos intentos/);
      expect(state.consumeCalls).toEqual([]);
      expect(state.signInCalls).toBe(0);
    },
  );
});
