import { describe, expect, it, vi } from "vitest";
import { loadMetaPixel, loadMetaPixelWithConsent, resolveMetaPixelId, trackMetaEvent } from "@/lib/analytics/metaPixel";

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
    expect(win.fbq?.queue.filter((args) => args[0] === "init")).toEqual([["init", "1234567890"]]);
  });

  it("apaga la configuración automática antes del init (sin clics ni datos de página)", () => {
    const win: { fbq?: ((...a: unknown[]) => void) & { queue: unknown[][] } } = {};
    const doc = { createElement: vi.fn(() => ({ async: false, src: "" })), getElementsByTagName: vi.fn(() => []) };
    loadMetaPixel("1234567890", win as never, doc as never);
    expect(win.fbq?.queue).toEqual([
      ["set", "autoConfig", false, "1234567890"],
      ["init", "1234567890"],
    ]);
  });

  it("en un link de invitación no carga el pixel (el token no sale hacia Meta)", () => {
    for (const search of ["?invitacion=abc", "?utm_source=x&invitacion=abc", "?next=%2Fpreregistro%3Finvitacion%3Dabc"]) {
      const win: Record<string, unknown> = { location: { search } };
      const createElement = vi.fn();
      const getElementsByTagName = vi.fn();
      expect(loadMetaPixel("1234567890", win as never, { createElement, getElementsByTagName } as never)).toBe(false);
      expect(createElement).not.toHaveBeenCalled();
      expect(win.fbq).toBeUndefined();
    }
  });

  it("con el pixel ya cargado, en un link de invitación no manda eventos", () => {
    const fbq = vi.fn();
    const win = { fbq, location: { search: "?invitacion=abc" } };
    expect(loadMetaPixel("1234567890", win as never, {} as never)).toBe(false);
    trackMetaEvent("PageView", undefined, win as never);
    trackMetaEvent("CompleteRegistration", "preregistro_estudiante", win as never);
    expect(fbq).not.toHaveBeenCalled();
  });

  it("cuenta cada pantalla: permite el PageView repetido y sigue sin el envío automático (que saltearía las exclusiones)", () => {
    const win: { fbq?: { disablePushState?: boolean; allowDuplicatePageViews?: boolean } } = {};
    const doc = { createElement: vi.fn(() => ({ async: false, src: "" })), getElementsByTagName: vi.fn(() => []) };
    loadMetaPixel("1234567890", win as never, doc as never);
    expect(win.fbq?.allowDuplicatePageViews).toBe(true);
    expect(win.fbq?.disablePushState).toBe(true);
  });

  it("sin ID (visitante excluido, por ejemplo un menor) no habilita el envío aunque el pixel ya esté cargado", () => {
    const fbq = vi.fn();
    expect(loadMetaPixelWithConsent(null, "granted", { fbq } as never, {} as never)).toBe(false);
    expect(fbq).not.toHaveBeenCalled();
  });

  it("trackMetaEvent no hace nada sin pixel y solo manda un rótulo fijo con pixel", () => {
    expect(() => trackMetaEvent("Lead", "solicitud_fundadora", {})).not.toThrow();
    const fbq = vi.fn();
    trackMetaEvent("CompleteRegistration", "preregistro_estudiante", { fbq } as never);
    expect(fbq).toHaveBeenCalledWith("track", "CompleteRegistration", { content_name: "preregistro_estudiante" });
  });
});
