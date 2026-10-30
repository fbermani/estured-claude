import { describe, expect, it } from "vitest";
import { groupMissingResidences, manualContactLink, residenceNameKey, sanitizeResidenceName, suggestedContactText } from "@/lib/residents/linkRequestRules";

describe("sanitizeResidenceName (DR21)", () => {
  it("colapsa espacios, saca <> y control y limita el largo", () => {
    expect(sanitizeResidenceName("  Casa   <b>Sur</b>\n")).not.toMatch(/[<>]/);
    expect(sanitizeResidenceName("x".repeat(300))).toHaveLength(120);
  });
  it("rechaza vacío o de 1 caracter", () => {
    expect(sanitizeResidenceName("   ")).toBeNull();
    expect(sanitizeResidenceName("a")).toBeNull();
    expect(sanitizeResidenceName(null)).toBeNull();
  });
});

describe("groupMissingResidences", () => {
  const row = (id: string, name: string, at: string, contacted: string | null = null, contact: string | null = null) => ({ id, residence_name: name, contact, created_at: at, contacted_at: contacted });
  it("agrupa por nombre sin tildes ni mayúsculas y cuenta estudiantes", () => {
    const g = groupMissingResidences([row("1", "Casa Súr", "2026-10-02"), row("2", "casa  sur", "2026-10-01", null, "11 5555 1234"), row("3", "Otra", "2026-10-03")]);
    expect(residenceNameKey("Casa Súr")).toBe(residenceNameKey("casa  sur"));
    expect(g).toHaveLength(2);
    const sur = g.find((x) => x.count === 2)!;
    expect(sur.firstAt).toBe("2026-10-01");
    expect(sur.contacts).toEqual(["11 5555 1234"]);
    expect(sur.ids).toEqual(["1", "2"]);
  });
  it("un pedido nuevo reabre una residencia ya contactada y los pendientes van primero", () => {
    const g = groupMissingResidences([row("1", "Alfa", "2026-10-01", "2026-10-05"), row("2", "Alfa", "2026-10-06"), row("3", "Beta", "2026-10-01", "2026-10-05")]);
    expect(g[0].name).toBe("Alfa");
    expect(g[0].contacted).toBe(false);
    expect(g[1].contacted).toBe(true);
  });
});

describe("manualContactLink", () => {
  it("arma mailto o wa.me solo con contactos válidos", () => {
    expect(manualContactLink("hola@casa.com", "x")?.kind).toBe("email");
    const wa = manualContactLink("+54 9 11 5555-1234", "hola mundo");
    expect(wa?.kind).toBe("whatsapp");
    expect(wa?.href.startsWith("https://wa.me/5491155551234?text=")).toBe(true);
    expect(manualContactLink("preguntar en portería", "x")).toBeNull();
    expect(manualContactLink(null, "x")).toBeNull();
  });
  it("rechaza mails raros y no deja pasar ? & ni espacios al href", () => {
    expect(manualContactLink("a@b.com?bcc=x@y.com", "x")).toBeNull();
    expect(manualContactLink("a b@c.com", "x")).toBeNull();
    expect(manualContactLink("a@b", "x")).toBeNull();
    const l = manualContactLink("ok+1@casa.com", "hola & chau?")!;
    expect(l.href).toBe("mailto:ok%2B1@casa.com?subject=" + encodeURIComponent("EstuRed: tus residentes ya tienen comunidad") + "&body=" + encodeURIComponent("hola & chau?"));
  });
  it("el texto sugerido no promete disponibilidad", () => {
    expect(suggestedContactText("Casa Sur")).not.toMatch(/garant|reserva/i);
  });
});
