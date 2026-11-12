import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M6 — `registerFamily` con cliente falso: rate limit persistente por IP antes de tocar la base, y un único mensaje neutro para
 * «no existe», «no es estudiante» y «ya tiene familiar» (el formulario no revela qué es cada email).
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/preapertura/flag", () => ({ isPreaperturaOn: () => false }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "198.51.100.7" }) }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/family/emailVerification", () => ({ sendFamilyEmailCode: async () => ({ ok: true }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => null }));

const state = vi.hoisted(() => ({
  limitOk: true,
  limitCalls: [] as Array<{ bucket: string; key: string; windowSeconds: number; max: number }>,
  rows: {} as Record<string, unknown>,
  dbTouched: 0,
  creates: 0,
}));
vi.mock("@/lib/security/rateLimit", () => ({
  consumeRateLimit: async (opts: { bucket: string; key: string; windowSeconds: number; max: number }) => {
    state.limitCalls.push(opts);
    return { ok: state.limitOk };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { createUser: async () => { state.creates++; return { data: { user: null }, error: { message: "no" } }; } } },
    from: (table: string) => {
      state.dbTouched++;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: state.rows[table] ?? null, error: null }),
      };
      return chain;
    },
  }),
}));

import { registerFamily } from "@/app/(public)/register/family/actions";

function form(): FormData {
  const f = new FormData();
  const base: Record<string, string> = {
    first_name: "Laura", last_name: "Paz", relationship_type: "madre", phone: "+54 11 5555 1234",
    email: "laura@mail.com", password: "Clave-segura-123", student_email: "ana@mail.com", accept_terms: "on", accept_privacy: "on",
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

beforeEach(() => {
  state.limitOk = true;
  state.limitCalls = [];
  state.rows = {};
  state.dbTouched = 0;
  state.creates = 0;
});

describe("registerFamily · M6", () => {
  it("limita 25 altas por hora por IP y, si corta, no toca la base", async () => {
    state.limitOk = false;
    const r = await registerFamily({ status: "idle" }, form());
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/muchos intentos/);
    expect(state.limitCalls).toEqual([{ bucket: "register_family_ip", key: "198.51.100.7", windowSeconds: 3600, max: 25 }]);
    expect(state.dbTouched).toBe(0);
  });

  it("mismo mensaje para email inexistente, cuenta sin perfil de estudiante y estudiante con familiar activo", async () => {
    const messages: Array<string | undefined> = [];

    messages.push((await registerFamily({ status: "idle" }, form())).message);

    state.rows = { users: { id: "u-admin" } };
    messages.push((await registerFamily({ status: "idle" }, form())).message);

    state.rows = { users: { id: "u-est" }, student_profiles: { id: "sp1" }, family_links: { id: "fl1" } };
    messages.push((await registerFamily({ status: "idle" }, form())).message);

    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toMatch(/No pudimos enviar la solicitud a ese email/);
    expect(state.creates).toBe(0);
  });
});
