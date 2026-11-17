import { describe, expect, it } from "vitest";
import { SHARE_FALLBACK_BASE_URL, getShareBaseUrl } from "@/lib/share/shareLink";

describe("getShareBaseUrl", () => {
  it("usa NEXT_PUBLIC_APP_URL sin barra final", () => {
    expect(getShareBaseUrl({ NEXT_PUBLIC_APP_URL: "https://estured.com//" })).toBe("https://estured.com");
  });
  it("cae a NEXT_PUBLIC_SITE_URL y después al dominio de staging", () => {
    expect(getShareBaseUrl({ NEXT_PUBLIC_SITE_URL: "https://sitio.test" })).toBe("https://sitio.test");
    expect(getShareBaseUrl({})).toBe(SHARE_FALLBACK_BASE_URL);
    expect(SHARE_FALLBACK_BASE_URL).toBe("https://estured.vercel.app");
  });
  it("nunca devuelve localhost ni un valor que no sea http(s)", () => {
    expect(getShareBaseUrl({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toBe(SHARE_FALLBACK_BASE_URL);
    expect(getShareBaseUrl({ NEXT_PUBLIC_APP_URL: "javascript:alert(1)" })).toBe(SHARE_FALLBACK_BASE_URL);
  });
});
