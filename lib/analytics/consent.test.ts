import { describe, expect, it, vi } from "vitest";
import { CONSENT_EVENT, parseConsent, readConsent, serializeConsentCookie, shouldShowCookieNotice, writeConsent } from "@/lib/analytics/consent";
import { loadMetaPixelWithConsent } from "@/lib/analytics/metaPixel";

describe("consentimiento: cookie er-consent", () => {
  it("lee granted y denied entre otras cookies; lo demás es null", () => {
    expect(parseConsent("a=1; er-consent=granted; b=2")).toBe("granted");
    expect(parseConsent("er-consent=denied")).toBe("denied");
    expect(parseConsent("er-consent=maybe")).toBeNull();
    expect(parseConsent("er-attr=x")).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });

  it("serializa 180 días, SameSite=Lax y Secure solo con https", () => {
    const https = serializeConsentCookie("granted", true);
    expect(https).toBe("er-consent=granted; Max-Age=15552000; Path=/; SameSite=Lax; Secure");
    expect(serializeConsentCookie("denied", false)).not.toContain("Secure");
  });

  it("escribe la cookie, la lee de nuevo y avisa con un evento", () => {
    const doc = { cookie: "" };
    const dispatchEvent = vi.fn(() => true);
    expect(writeConsent("denied", false, doc, { dispatchEvent })).toBe(true);
    expect(doc.cookie).toContain("er-consent=denied");
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect((dispatchEvent.mock.calls[0] as unknown as [CustomEvent])[0].type).toBe(CONSENT_EVENT);
    expect(readConsent({ cookie: "er-consent=denied" })).toBe("denied");
  });

  it("con cookies bloqueadas no lanza y devuelve false / null", () => {
    const blocked = {
      get cookie(): string {
        throw new Error("blocked");
      },
      set cookie(_v: string) {
        throw new Error("blocked");
      },
    };
    expect(writeConsent("granted", true, blocked, null)).toBe(false);
    expect(readConsent(blocked)).toBeNull();
  });
});

describe("el aviso y el pixel respetan la elección", () => {
  it("el aviso no se muestra sin ID de pixel ni con elección previa", () => {
    expect(shouldShowCookieNotice(null, null)).toBe(false);
    expect(shouldShowCookieNotice("1234567890", "granted")).toBe(false);
    expect(shouldShowCookieNotice("1234567890", "denied")).toBe(false);
    expect(shouldShowCookieNotice("1234567890", null)).toBe(true);
  });

  it("el pixel no carga sin granted (ni toca el documento)", () => {
    for (const consent of [null, "denied"] as const) {
      const win: Record<string, unknown> = {};
      const createElement = vi.fn();
      expect(loadMetaPixelWithConsent("1234567890", consent, win as never, { createElement, getElementsByTagName: vi.fn() } as never)).toBe(false);
      expect(createElement).not.toHaveBeenCalled();
      expect(win.fbq).toBeUndefined();
    }
  });

  it("con granted carga el pixel", () => {
    const win: Record<string, unknown> = {};
    const doc = { createElement: vi.fn(() => ({ async: false, src: "" })), getElementsByTagName: vi.fn(() => [{ parentNode: { insertBefore: vi.fn() } }]) };
    expect(loadMetaPixelWithConsent("1234567890", "granted", win as never, doc as never)).toBe(true);
    expect(win.fbq).toBeDefined();
  });
});
