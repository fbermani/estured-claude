import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_TEMPLATE,
  SHARE_PLACEHOLDERS,
  SHARE_TEMPLATE_MAX,
  buildShareLink,
  buildWhatsappMessageLink,
  buildShareValues,
  buildStayConditions,
  buildWhatsappShareUrl,
  normalizeShareTemplate,
  resolveShareMessage,
  validateShareTemplate,
  type ShareDataInput,
} from "@/lib/share/resolveShareMessage";

const FULL: ShareDataInput = {
  link: "https://estured.vercel.app/r/residencia-norte-demo",
  fromPriceUsd: 190,
  arsPerUsd: 1480,
  zone: "Palermo",
  nearestUniversityName: "Universidad de Palermo",
  minimumStayMonths: 6,
  enrollmentFeeMode: null,
  enrollmentFeeUsd: null,
  depositUsd: 300,
  depositMode: null,
};

describe("plantilla original", () => {
  it("es válida y trae cada dato conocido", () => {
    expect(validateShareTemplate(DEFAULT_SHARE_TEMPLATE)).toEqual({ ok: true, template: DEFAULT_SHARE_TEMPLATE });
    for (const p of SHARE_PLACEHOLDERS) expect(DEFAULT_SHARE_TEMPLATE).toContain(`{${p.key}}`);
    expect(DEFAULT_SHARE_TEMPLATE.length).toBeLessThanOrEqual(SHARE_TEMPLATE_MAX);
  });

  it("se resuelve con USD y su referencia en ARS, sin llaves ni «US$»", () => {
    const text = resolveShareMessage(DEFAULT_SHARE_TEMPLATE, buildShareValues(FULL));
    expect(text).toContain("https://estured.vercel.app/r/residencia-norte-demo");
    // 190 × 1480 = 281.200 → se redondea a 281.000 como en el resto de la ficha.
    expect(text).toContain("Habitaciones desde USD 190 por mes (referencia ≈ ARS 281.000, valor referencial)");
    expect(text).toContain("- Palermo, cerca de U. de Palermo");
    expect(text).toContain("- Estadía mínima de 6 meses, sin matrícula, depósito de USD 300 (≈ ARS 444.000)");
    expect(text).not.toMatch(/[{}]/);
    expect(text).not.toMatch(/US\$/);
    expect(text.length).toBeLessThanOrEqual(SHARE_TEMPLATE_MAX);
  });
});

describe("datos que faltan: se omite la línea entera, sin huecos", () => {
  it("sin precio se omite la línea del precio (USD y ARS salen juntos)", () => {
    const values = buildShareValues({ ...FULL, fromPriceUsd: null });
    expect(values.PRICE_FROM).toBeNull();
    expect(values.PRICE_FROM_ARS).toBeNull();
    const text = resolveShareMessage(DEFAULT_SHARE_TEMPLATE, values);
    expect(text).not.toContain("Habitaciones desde");
    expect(text).not.toMatch(/\n\n/);
  });

  it("sin cotización válida no se afirma ningún monto en pesos ni en USD", () => {
    const values = buildShareValues({ ...FULL, arsPerUsd: 0 });
    expect(values.PRICE_FROM).toBeNull();
    expect(values.PRICE_FROM_ARS).toBeNull();
  });

  it("sin universidad cercana se omite «{ZONE}, cerca de {UNIVERSITY}» y no queda ni una coma colgada", () => {
    const text = resolveShareMessage(DEFAULT_SHARE_TEMPLATE, buildShareValues({ ...FULL, nearestUniversityName: null }));
    expect(text).not.toContain("cerca de");
    expect(text).not.toContain("Palermo,");
    expect(text.split("\n")).toHaveLength(DEFAULT_SHARE_TEMPLATE.split("\n").length - 1);
  });

  it("sin ningún dato opcional queda solo el saludo con el link y el cierre", () => {
    const values = buildShareValues({ ...FULL, fromPriceUsd: null, zone: null, nearestUniversityName: null, minimumStayMonths: null, enrollmentFeeMode: "manual", depositUsd: null });
    const lines = resolveShareMessage(DEFAULT_SHARE_TEMPLATE, values).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(FULL.link);
    expect(lines[1]).toMatch(/^Ahí tenés toda nuestra info/);
  });

  it("los espacios en blanco cuentan como dato faltante", () => {
    expect(resolveShareMessage("Hola {ZONE}\nLink: {LINK}", { LINK: "https://x.test/r/a", ZONE: "   " })).toBe("Link: https://x.test/r/a");
  });

  it("una línea en blanco escrita por la residencia se conserva, pero nunca quedan dos seguidas ni al principio o al final", () => {
    const text = resolveShareMessage("\n\nHola\n\n\n{LINK}\n\n", { LINK: "https://x.test/r/a" });
    expect(text).toBe("Hola\n\nhttps://x.test/r/a");
  });

  it("si se omite la línea del medio entre dos en blanco no queda un doble hueco", () => {
    expect(resolveShareMessage("Hola\n\n{ZONE}\n\n{LINK}", { LINK: "L" })).toBe("Hola\n\nL");
  });
});

describe("condiciones de estadía", () => {
  const base = { minimumStayMonths: null, enrollmentFeeMode: "manual" as const, enrollmentFeeUsd: null, depositUsd: null, depositMode: null, arsPerUsd: 1480 };
  it("estadía mínima de 1 mes en singular", () => {
    expect(buildStayConditions({ ...base, minimumStayMonths: 1 })).toBe("Estadía mínima de 1 mes");
  });
  it("«sin matrícula» solo si la residencia declaró que no cobra; con matrícula fija lleva su ARS", () => {
    expect(buildStayConditions({ ...base, minimumStayMonths: 6, enrollmentFeeMode: null })).toBe("Estadía mínima de 6 meses, sin matrícula");
    expect(buildStayConditions({ ...base, minimumStayMonths: 6, enrollmentFeeMode: "manual", enrollmentFeeUsd: 100 })).toBe(
      "Estadía mínima de 6 meses, matrícula de USD 100 (≈ ARS 148.000)",
    );
    expect(buildStayConditions({ ...base, minimumStayMonths: 3, enrollmentFeeMode: "one_month" })).toBe("Estadía mínima de 3 meses, matrícula de un mes");
  });
  it("depósito fijo en USD con su ARS, o por modo; dato inconsistente no se afirma", () => {
    expect(buildStayConditions({ ...base, depositUsd: 300 })).toBe("Depósito de USD 300 (≈ ARS 444.000)");
    expect(buildStayConditions({ ...base, depositMode: "one_month" })).toBe("Depósito de 1 mes de renta");
    expect(buildStayConditions(base)).toBeNull();
  });
});

describe("moneda: siempre USD con referencia en ARS", () => {
  it("los montos usan el formato «USD n» (nunca «US$») y la cotización recibida", () => {
    const values = buildShareValues({ ...FULL, fromPriceUsd: 250, arsPerUsd: 1000 });
    expect(values.PRICE_FROM).toBe("250");
    expect(values.PRICE_FROM_ARS).toBe("250.000");
    const text = resolveShareMessage(DEFAULT_SHARE_TEMPLATE, values);
    expect(text).toContain("USD 250 por mes");
    expect(text).toContain("ARS 250.000");
    expect(JSON.stringify(values)).not.toContain("US$");
  });
});

describe("validateShareTemplate", () => {
  it("rechaza un mensaje vacío", () => {
    expect(validateShareTemplate("   \n ").ok).toBe(false);
    expect(validateShareTemplate(undefined).ok).toBe(false);
    expect(validateShareTemplate(42).ok).toBe(false);
  });

  it("exige {LINK}", () => {
    const r = validateShareTemplate("Hola, mirá nuestra ficha.");
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("{LINK}");
  });

  it("acepta exactamente 1.000 caracteres y rechaza 1.001", () => {
    const filler = (n: number) => "a".repeat(n - "{LINK}".length);
    expect(validateShareTemplate(`{LINK}${filler(SHARE_TEMPLATE_MAX)}`)).toMatchObject({ ok: true });
    const tooLong = validateShareTemplate(`{LINK}${filler(SHARE_TEMPLATE_MAX + 1)}`);
    expect(tooLong).toMatchObject({ ok: false });
    expect((tooLong as { error: string }).error).toMatch(/1\.000/);
  });

  it("el texto ya resuelto también tiene que entrar en el máximo", () => {
    expect(validateShareTemplate("{LINK}", { resolvedLength: SHARE_TEMPLATE_MAX })).toMatchObject({ ok: true });
    expect(validateShareTemplate("{LINK}", { resolvedLength: SHARE_TEMPLATE_MAX + 1 })).toMatchObject({ ok: false });
  });

  it("solo placeholders conocidos: nombra los desconocidos", () => {
    const r = validateShareTemplate("Hola {LINK} {NOMBRE} {PRICE}");
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("{NOMBRE}");
    expect((r as { error: string }).error).toContain("{PRICE}");
    expect(validateShareTemplate("Hola {link}")).toMatchObject({ ok: false });
  });

  it("llaves sueltas o dobles no pasan", () => {
    expect(validateShareTemplate("Hola {LINK")).toMatchObject({ ok: false });
    expect(validateShareTemplate("Hola LINK} {LINK}")).toMatchObject({ ok: false });
    expect(validateShareTemplate("Hola {{LINK}}")).toMatchObject({ ok: false });
  });

  it("no admite «US$»", () => {
    const r = validateShareTemplate("Desde US$ {PRICE_FROM} {LINK}");
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toContain("USD");
  });

  it("normaliza saltos de línea y espacios finales", () => {
    expect(normalizeShareTemplate("  Hola  \r\n{LINK}\t \r\n")).toBe("Hola\n{LINK}");
    expect(normalizeShareTemplate("a\u0000b\u0007c")).toBe("abc");
  });
});

describe("enlace y WhatsApp", () => {
  it("arma el link corto /r/<slug> sin barras de más", () => {
    expect(buildShareLink("https://estured.vercel.app/", "residencia-norte-demo")).toBe("https://estured.vercel.app/r/residencia-norte-demo");
  });

  it("el link dentro del mensaje de WhatsApp lleva ?ref=wa y el link limpio no", () => {
    expect(buildWhatsappMessageLink("https://estured.vercel.app/", "residencia-norte-demo")).toBe(
      "https://estured.vercel.app/r/residencia-norte-demo?ref=wa",
    );
  });

  it("la URL de WhatsApp es wa.me con el texto codificado (botón manual, sin API)", () => {
    const url = buildWhatsappShareUrl("Hola & chau\n¿Qué tal? https://x.test/r/a?b=1");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toContain(" ");
    expect(url).not.toContain("\n");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("Hola & chau\n¿Qué tal? https://x.test/r/a?b=1");
  });
});
