import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppUrl } from "./appUrl";

afterEach(() => vi.unstubAllEnvs());

describe("getAppUrl", () => {
  it("devuelve la variable sin barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://estured.vercel.app//");
    expect(getAppUrl()).toBe("https://estured.vercel.app");
  });
  it("usa localhost si falta fuera de producción", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(getAppUrl()).toBe("http://localhost:3000");
  });
  it("lanza si falta en producción", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
