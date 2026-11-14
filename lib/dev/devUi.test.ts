import { afterEach, describe, expect, it, vi } from "vitest";
import { isDevUi } from "@/lib/dev/devUi";

describe("isDevUi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sí en desarrollo", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDevUi()).toBe(true);
  });
  it("no en producción sin la variable de staging", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevUi()).toBe(false);
  });
  it("sí en el staging de Vercel (Preview con NEXT_PUBLIC_STAGING=on)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_STAGING", "on");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isDevUi()).toBe(true);
  });
  it("NUNCA en producción de Vercel, aunque la variable se cargue por error", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_STAGING", "on");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isDevUi()).toBe(false);
  });
});
