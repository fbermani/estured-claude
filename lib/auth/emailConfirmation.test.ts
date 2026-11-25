import { afterEach, describe, expect, it, vi } from "vitest";
import { isSignupEmailConfirmationRequired } from "@/lib/auth/emailConfirmation";

describe("DR65 (d): confirmación de email solo con dominio verificado", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin EMAIL_FROM (staging, Resend sandbox) no se exige", () => {
    vi.stubEnv("EMAIL_FROM", "");
    expect(isSignupEmailConfirmationRequired()).toBe(false);
  });

  it("con EMAIL_FROM válido se exige; uno inválido no cuenta", () => {
    vi.stubEnv("EMAIL_FROM", "no-reply@estured.com");
    expect(isSignupEmailConfirmationRequired()).toBe(true);
    vi.stubEnv("EMAIL_FROM", "EstuRed <x@y.com>, otro@z.com");
    expect(isSignupEmailConfirmationRequired()).toBe(false);
  });
});
