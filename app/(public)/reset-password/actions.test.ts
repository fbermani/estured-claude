import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H13 — `resetPassword` con cliente Supabase falso: valida antes de canjear
 * el código, rechaza cuentas bloqueadas sin cambiar la contraseña y, si
 * sale bien, audita, cierra sesiones y redirige a /login.
 */
const state = vi.hoisted(() => ({
  exchangeError: null as { code?: string; message: string } | null,
  user: { id: "user-1" } as { id: string } | null,
  appUser: { is_active: true, is_blocked: false } as { is_active: boolean; is_blocked: boolean } | null,
  updateError: null as { code?: string; message: string } | null,
  calls: [] as string[],
  audits: [] as { action: string }[],
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: async () => ({
    auth: {
      exchangeCodeForSession: async () => {
        state.calls.push("exchange");
        return { data: {}, error: state.exchangeError };
      },
      updateUser: async () => {
        state.calls.push("updateUser");
        return { data: {}, error: state.updateError };
      },
      signOut: async (opts?: { scope?: string }) => {
        state.calls.push(`signOut:${opts?.scope}`);
        return { error: null };
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.appUser, error: null }) }) }),
    }),
  }),
}));
vi.mock("@/lib/supabase/safe-get-user", () => ({ getSafeUser: async () => state.user }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: { action: string }) => {
    state.audits.push(entry);
    return true;
  },
}));

import { resetPassword } from "@/app/(public)/reset-password/actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const idle = { status: "idle" } as const;
const ok = { code: "abc", password: "nueva-clave-1", password_confirmation: "nueva-clave-1" };

beforeEach(() => {
  state.exchangeError = null;
  state.user = { id: "user-1" };
  state.appUser = { is_active: true, is_blocked: false };
  state.updateError = null;
  state.calls = [];
  state.audits = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("resetPassword", () => {
  it("sin código devuelve el error de enlace vencido y no toca Supabase", async () => {
    const res = await resetPassword(idle, form({ ...ok, code: "" }));
    expect(res).toMatchObject({ status: "error", linkExpired: true });
    expect(state.calls).toEqual([]);
  });

  it("contraseña inválida o distinta: error sin canjear el código (el enlace sigue vivo)", async () => {
    const corta = await resetPassword(idle, form({ ...ok, password: "corta", password_confirmation: "corta" }));
    expect(corta).toMatchObject({ status: "error" });
    const distinta = await resetPassword(idle, form({ ...ok, password_confirmation: "otra-clave-12" }));
    expect(distinta).toEqual({ status: "error", message: "Las contraseñas no coinciden." });
    expect(state.calls).toEqual([]);
  });

  it("código inválido o vencido: error con opción de pedir otro enlace y sin cambiar la contraseña", async () => {
    state.exchangeError = { code: "flow_state_not_found", message: "no existe" };
    const res = await resetPassword(idle, form(ok));
    expect(res).toMatchObject({ status: "error", linkExpired: true });
    expect(state.calls).toEqual(["exchange"]);
  });

  it.each([
    ["bloqueada", { is_active: true, is_blocked: true }],
    ["inactiva", { is_active: false, is_blocked: false }],
    ["sin fila en users", null],
  ])("cuenta %s: no cambia la contraseña y cierra la sesión de recuperación", async (_n, appUser) => {
    state.appUser = appUser;
    const res = await resetPassword(idle, form(ok));
    expect(res).toMatchObject({ status: "error" });
    expect(state.calls).toEqual(["exchange", "signOut:local"]);
    expect(state.calls).not.toContain("updateUser");
    expect(state.audits.map((a) => a.action)).toEqual(["password_reset_denied"]);
  });

  it("flujo feliz: actualiza, audita, cierra todas las sesiones y redirige a /login?reset=ok", async () => {
    await expect(resetPassword(idle, form(ok))).rejects.toThrow("NEXT_REDIRECT:/login?reset=ok");
    expect(state.calls).toEqual(["exchange", "updateUser", "signOut:global"]);
    expect(state.audits.map((a) => a.action)).toEqual(["password_reset_completed"]);
  });

  it("mapea los errores de Supabase a mensajes en español sin jerga", async () => {
    state.updateError = { code: "same_password", message: "New password should be different" };
    const same = await resetPassword(idle, form(ok));
    expect(same).toMatchObject({ status: "error", linkExpired: true, message: expect.stringMatching(/distinta/) });
    // El código ya se canjeó: la sesión de recuperación no queda abierta.
    expect(state.calls).toEqual(["exchange", "updateUser", "signOut:local"]);

    state.calls = [];
    state.updateError = { code: "weak_password", message: "weak" };
    const weak = await resetPassword(idle, form(ok));
    expect(weak).toMatchObject({ status: "error", linkExpired: true, message: expect.stringMatching(/fácil de adivinar/) });
    expect(state.calls).toContain("signOut:local");
    state.calls = [];

    state.updateError = { code: "unexpected_failure", message: "boom" };
    const other = await resetPassword(idle, form(ok));
    expect(other).toMatchObject({ status: "error", linkExpired: true });
    expect((other as { message: string }).message).not.toMatch(/boom/);
    expect(state.calls).toContain("signOut:local");
    expect(state.audits).toEqual([]);
  });
});
