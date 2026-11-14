import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function form(token?: string): FormData {
  const fd = new FormData();
  if (token !== undefined) fd.set("cf-turnstile-response", token);
  return fd;
}

describe("verifyTurnstile", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function load() {
    return (await import("./turnstile")).verifyTurnstile;
  }

  it("devuelve true si Cloudflare responde success y manda secret, response y remoteip", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const verify = await load();
    expect(await verify(form("tok"), "1.2.3.4")).toBe(true);
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("devuelve false si Cloudflare responde success false", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    expect(await (await load())(form("tok"), null)).toBe(false);
  });

  it("token vacío, ausente o enorme: false sin llamar a la red", async () => {
    const verify = await load();
    expect(await verify(form(""), null)).toBe(false);
    expect(await verify(form(), null)).toBe(false);
    expect(await verify(form("x".repeat(2049)), null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("error de red: false", async () => {
    fetchMock.mockRejectedValue(new Error("red caída"));
    expect(await (await load())(form("tok"), null)).toBe(false);
  });

  it("timeout (abort): false", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(new Error("abort")))),
    );
    vi.useFakeTimers();
    try {
      const p = (await load())(form("tok"), null);
      await vi.advanceTimersByTimeAsync(5_100);
      expect(await p).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sin secret: fail-open fuera de producción", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await (await load())(form(), null)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin secret: fail-closed en producción", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await load())(form("tok"), null)).toBe(false);
  });

  it("producción con el secret de PRUEBA de Cloudflare: fail-closed sin llamar a la red", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await load())(form("tok"), null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fuera de producción el secret de prueba sigue funcionando", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubEnv("NODE_ENV", "development");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    expect(await (await load())(form("tok"), null)).toBe(true);
  });
});
