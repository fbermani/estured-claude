import { describe, expect, it } from "vitest";
import {
  attributionFromSearch,
  isMissingAttributionColumn,
  parseAttributionCookie,
  sanitizeAttribution,
  sanitizeAttributionValue,
  serializeAttributionCookie,
} from "@/lib/attribution/attribution";

describe("atribución: saneado", () => {
  it("recorta a 100 caracteres y quita lo que no es texto de campaña", () => {
    expect(sanitizeAttributionValue("a".repeat(250))).toHaveLength(100);
    expect(sanitizeAttributionValue("  reel<script>alert(1)</script>_nov  ")).toBe("reelscriptalert1/script_nov");
    expect(sanitizeAttributionValue("a\u0000b\nc")).toBe("abc");
    expect(sanitizeAttributionValue("<>\"'`;{}")).toBeNull();
    expect(sanitizeAttributionValue(42)).toBeNull();
    expect(sanitizeAttributionValue("   ")).toBeNull();
  });

  it("descarta claves desconocidas y devuelve null sin ninguna válida", () => {
    expect(sanitizeAttribution({ utm_source: "instagram", email: "a@b.com", foo: "x" })).toEqual({ utm_source: "instagram" });
    expect(sanitizeAttribution({ email: "a@b.com" })).toBeNull();
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution(["utm_source"])).toBeNull();
    expect(sanitizeAttribution("utm_source=x")).toBeNull();
  });

  it("toma los seis parámetros de la URL y solo si hay al menos uno", () => {
    const got = attributionFromSearch("?utm_source=meta&utm_medium=cpc&utm_campaign=test1&utm_content=reel-3&utm_term=residencia&fbclid=IwAR_abc-123&otro=1");
    expect(got).toEqual({ utm_source: "meta", utm_medium: "cpc", utm_campaign: "test1", utm_content: "reel-3", utm_term: "residencia", fbclid: "IwAR_abc-123" });
    expect(attributionFromSearch("?otro=1")).toBeNull();
    expect(attributionFromSearch("")).toBeNull();
    expect(attributionFromSearch("?utm_source=")).toBeNull();
  });
});

describe("atribución: cookie", () => {
  it("ida y vuelta", () => {
    const value = serializeAttributionCookie({ utm_source: "instagram", utm_campaign: "a b" });
    expect(parseAttributionCookie(value)).toEqual({ utm_source: "instagram", utm_campaign: "a b" });
  });

  it("una cookie manipulada se vuelve a sanear o se descarta", () => {
    const tampered = encodeURIComponent(JSON.stringify({ utm_source: "x".repeat(500), admin: true }));
    expect(parseAttributionCookie(tampered)).toEqual({ utm_source: "x".repeat(100) });
    expect(parseAttributionCookie("%E0%A4%A")).toBeNull();
    expect(parseAttributionCookie("no-es-json")).toBeNull();
    expect(parseAttributionCookie("a".repeat(2_000))).toBeNull();
    expect(parseAttributionCookie(undefined)).toBeNull();
  });
});

describe("atribución: columna faltante", () => {
  it("reconoce el error de la migración 0106 sin aplicar", () => {
    expect(isMissingAttributionColumn({ code: "PGRST204", message: "Could not find the 'attribution' column of 'preapertura_estudiantes'" })).toBe(true);
    expect(isMissingAttributionColumn({ code: "42703", message: 'column "attribution" of relation "x" does not exist' })).toBe(true);
    expect(isMissingAttributionColumn({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingAttributionColumn(null)).toBe(false);
  });
});
