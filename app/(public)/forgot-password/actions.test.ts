import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H13 — `requestPasswordReset` con cliente Supabase falso: respuesta siempre
 * neutra (no revela si la cuenta existe) y sin envío para cuentas bloqueadas.
 */
const state = vi.hoisted(() => ({
  appUser: null as { is_active: boolean; is_blocked: boolean } | null,
  resetCalls: [] as { email: string; redirectTo?: string }[],
  resetError: null as { message: string; code?: string } | null,
  resetThrows: false,
  serverClient: true,
  ipAllowed: true,
  emailAllowed: true,
  padCalls: 0,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "1.2.3.4" }),
}));
vi.mock("@/lib/auth/resetThrottle", () => ({
  resetByIpAllowed: () => state.ipAllowed,
  resetByEmailAllowed: () => state.emailAllowed,
  padToMinimum: async () => {
    state.padCalls += 1;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () =>
    state.serverClient
      ? {
          auth: {
            resetPasswordForEmail: async (email: string, opts?: { redirectTo?: string }) => {
              if (state.resetThrows) throw new Error("red caída");
              state.resetCalls.push({ email, redirectTo: opts?.redirectTo });
              return { data: {}, error: state.resetError };
            },
          },
        }
      : null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.appUser, error: null }) }) }),
    }),
  }),
}));

import { requestPasswordReset } from "@/app/(public)/forgot-password/actions";

function form(email: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}
const idle = { status: "idle" } as const;

beforeEach(() => {
  state.appUser = { is_active: true, is_blocked: false };
  state.resetCalls = [];
  state.resetError = null;
  state.resetThrows = false;
  state.serverClient = true;
  state.ipAllowed = true;
  state.emailAllowed = true;
  state.padCalls = 0;
  process.env.NEXT_PUBLIC_APP_URL = "https://estured.test";
});

describe("requestPasswordReset", () => {
  it("rechaza un email con formato inválido sin llamar a Supabase", async () => {
    const res = await requestPasswordReset(idle, form("no-es-un-email"));
    expect(res.status).toBe("error");
    expect(state.resetCalls).toHaveLength(0);
  });

  it("cuenta existente: envía con el redirect a /reset-password y responde neutro", async () => {
    const res = await requestPasswordReset(idle, form("  Ana@Example.com "));
    expect(res).toEqual({ status: "sent" });
    expect(state.resetCalls).toEqual([
      { email: "ana@example.com", redirectTo: "https://estured.test/reset-password" },
    ]);
  });

  it("cuenta inexistente: misma respuesta neutra que una existente", async () => {
    state.appUser = null;
    const res = await requestPasswordReset(idle, form("nadie@example.com"));
    expect(res).toEqual({ status: "sent" });
  });

  it("cuenta bloqueada o inactiva: responde neutro, NO envía el enlace a su email y hace la misma llamada", async () => {
    state.appUser = { is_active: true, is_blocked: true };
    expect(await requestPasswordReset(idle, form("bloqueada@example.com"))).toEqual({ status: "sent" });
    state.appUser = { is_active: false, is_blocked: false };
    expect(await requestPasswordReset(idle, form("inactiva@example.com"))).toEqual({ status: "sent" });
    // Mismo trabajo observable que una cuenta normal: una llamada a Supabase, pero a un destino inexistente.
    expect(state.resetCalls).toHaveLength(2);
    for (const call of state.resetCalls) expect(call.email).toMatch(/^noop-.+@estured\.invalid$/);
    expect(state.resetCalls.map((c) => c.email)).not.toContain("bloqueada@example.com");
  });

  it("todas las ramas esperan el piso de tiempo de respuesta", async () => {
    await requestPasswordReset(idle, form("ana@example.com"));
    state.appUser = { is_active: true, is_blocked: true };
    await requestPasswordReset(idle, form("bloqueada@example.com"));
    state.emailAllowed = false;
    await requestPasswordReset(idle, form("otra@example.com"));
    expect(state.padCalls).toBe(3);
  });

  it("límite por IP: error explícito sin llamar a Supabase", async () => {
    state.ipAllowed = false;
    const res = await requestPasswordReset(idle, form("ana@example.com"));
    expect(res.status).toBe("error");
    expect(state.resetCalls).toHaveLength(0);
  });

  it("límite por email: respuesta neutra sin enviar al email real", async () => {
    state.emailAllowed = false;
    expect(await requestPasswordReset(idle, form("ana@example.com"))).toEqual({ status: "sent" });
    expect(state.resetCalls).toHaveLength(1);
    expect(state.resetCalls[0].email).toMatch(/@estured\.invalid$/);
  });

  it("no expone errores crudos de Supabase (rate limit, SMTP) ni excepciones", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    state.resetError = { message: "email rate limit exceeded", code: "over_email_send_rate_limit" };
    expect(await requestPasswordReset(idle, form("ana@example.com"))).toEqual({ status: "sent" });
    state.resetThrows = true;
    expect(await requestPasswordReset(idle, form("ana@example.com"))).toEqual({ status: "sent" });
    warn.mockRestore();
  });

  it("sin Supabase configurado devuelve un error accionable en español", async () => {
    state.serverClient = false;
    const res = await requestPasswordReset(idle, form("ana@example.com"));
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.message).toMatch(/no está disponible/);
  });
});
