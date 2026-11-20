import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null }));

import { consumeRateLimit, emailRateLimitKey, hashRateLimitKey } from "@/lib/security/rateLimit";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

/** Cliente falso mínimo: registra las llamadas a `rpc` y devuelve un resultado fijo (o lanza). */
function fakeClient(result: RpcResult | "throw") {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (result === "throw") throw new Error("red caída");
      return result;
    },
  };
  return { client: client as never, calls };
}

const opts = { bucket: "login_email", key: "Ana@Example.com", windowSeconds: 900, max: 5 };
const env = process.env as Record<string, string | undefined>;
const originalEnv = env.NODE_ENV;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  env.NODE_ENV = originalEnv;
  errorSpy.mockRestore();
});

describe("consumeRateLimit (cliente falso)", () => {
  it("llama la RPC con la clave hasheada (nunca en claro) y los parámetros", async () => {
    const { client, calls } = fakeClient({ data: true, error: null });
    expect(await consumeRateLimit(opts, client)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("consume_rate_limit");
    expect(calls[0].args).toEqual({
      p_bucket: "login_email",
      p_key_hash: hashRateLimitKey("Ana@Example.com"),
      p_window_seconds: 900,
      p_max: 5,
    });
    expect(JSON.stringify(calls[0].args)).not.toContain("Ana@Example.com");
    expect(calls[0].args.p_key_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("devuelve ok:false cuando la RPC dice que se pasó del límite", async () => {
    const { client } = fakeClient({ data: false, error: null });
    expect(await consumeRateLimit(opts, client)).toEqual({ ok: false });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("fuera de producción, error de RPC / excepción / sin cliente: deja pasar y loguea sin PII", async () => {
    env.NODE_ENV = "development";
    expect(await consumeRateLimit(opts, fakeClient({ data: null, error: { code: "PGRST202", message: "no existe" } }).client)).toEqual({ ok: true });
    expect(await consumeRateLimit(opts, fakeClient("throw").client)).toEqual({ ok: true });
    expect(await consumeRateLimit(opts, null)).toEqual({ ok: true });
    expect(await consumeRateLimit(opts)).toEqual({ ok: true }); // getSupabaseAdmin() → null
    expect(errorSpy).toHaveBeenCalledTimes(4);
    for (const call of errorSpy.mock.calls) {
      const line = call.map(String).join(" ");
      expect(line).toContain("login_email");
      expect(line.toLowerCase()).not.toContain("ana@example.com");
      expect(line).not.toContain(hashRateLimitKey("Ana@Example.com"));
    }
  });

  it("en producción, si la RPC falla, corta (fail-closed)", async () => {
    env.NODE_ENV = "production";
    expect(await consumeRateLimit(opts, fakeClient({ data: null, error: { message: "x" } }).client)).toEqual({ ok: false });
    expect(await consumeRateLimit(opts, null)).toEqual({ ok: false });
  });

  it("una respuesta no booleana se trata como falla", async () => {
    env.NODE_ENV = "development";
    expect(await consumeRateLimit(opts, fakeClient({ data: "true", error: null }).client)).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("emailRateLimitKey normaliza mayúsculas y espacios", () => {
    expect(emailRateLimitKey("  Ana@Example.COM ")).toBe("ana@example.com");
  });
});
