import { describe, expect, it, vi } from "vitest";
import { loadMetaPixel, resolveMetaPixelId, trackMetaEvent } from "@/lib/analytics/metaPixel";

describe("Meta Pixel: inerte por defecto", () => {
  it("sin ID no hay pixel", () => {
    expect(resolveMetaPixelId({ VERCEL_ENV: "production" })).toBeNull();
    expect(resolveMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "  ", VERCEL_ENV: "production" })).toBeNull();
  });

  it("fuera de producción de Vercel no hay pixel, aunque haya ID", () => {
    expect(resolveMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "1234567890" })).toBeNull();
    expect(resolveMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "1234567890", VERCEL_ENV: "preview" })).toBeNull();
    expect(resolveMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "1234567890", VERCEL_ENV: "development" })).toBeNull();
  });

  it("un ID que no es numérico se rechaza (no se inyecta en el script)", () => {
    expect(resolveMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: "123');alert(1);//", VERCEL_ENV: "production" })).toBeNull();
  });

  it("con ID válido en producción devuelve el ID", () => {
    expect(resolveMetaPixelId({ NEXT_PUBLIC_META_PIXEL_ID: " 1234567890 ", VERCEL_ENV: "production" })).toBe("1234567890");
  });

  it("sin ID no toca el documento ni crea fbq", () => {
    const win: Record<string, unknown> = {};
    const createElement = vi.fn();
    const getElementsByTagName = vi.fn();
    expect(loadMetaPixel(null, win, { createElement, getElementsByTagName } as never)).toBe(false);
    expect(createElement).not.toHaveBeenCalled();
    expect(getElementsByTagName).not.toHaveBeenCalled();
    expect(win.fbq).toBeUndefined();
  });

  it("con ID inyecta el script una sola vez y hace init", () => {
    const win: { fbq?: ((...a: unknown[]) => void) & { queue: unknown[][] } } = {};
    const insertBefore = vi.fn();
    const script = { async: false, src: "" };
    const doc = { createElement: vi.fn(() => script), getElementsByTagName: vi.fn(() => [{ parentNode: { insertBefore } }]) };
    expect(loadMetaPixel("1234567890", win as never, doc as never)).toBe(true);
    expect(loadMetaPixel("1234567890", win as never, doc as never)).toBe(true);
    expect(doc.createElement).toHaveBeenCalledTimes(1);
    expect(insertBefore).toHaveBeenCalledTimes(1);
    expect(script.src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(win.fbq?.queue[0]).toEqual(["init", "1234567890"]);
  });

  it("trackMetaEvent no hace nada sin pixel y solo manda un rótulo fijo con pixel", () => {
    expect(() => trackMetaEvent("Lead", "solicitud_fundadora", {})).not.toThrow();
    const fbq = vi.fn();
    trackMetaEvent("CompleteRegistration", "preregistro_estudiante", { fbq } as never);
    expect(fbq).toHaveBeenCalledWith("track", "CompleteRegistration", { content_name: "preregistro_estudiante" });
  });
});
