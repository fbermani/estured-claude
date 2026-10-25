import { describe, expect, it } from "vitest";
import { MODEL_ARTICLES, buildModelText, findPlaceholders, renderPlaceholders } from "@/lib/regulations/modelTemplate";
import { MAX_REGULATION_LENGTH, hashRegulationText, normalizeRegulationText, validateRegulationText } from "@/lib/regulations/text";

const GOOD = `CONVIVENCIA\n\nArt. 1. Silencio\n${"Se guarda silencio desde las 23:00 hasta las 7:00 en toda la residencia. ".repeat(4)}`;

describe("modelo de reglamento (DR14)", () => {
  it("tiene los 61 artículos del documento de propuestas, correlativos y sin copy prohibido", () => {
    expect(MODEL_ARTICLES).toHaveLength(61);
    MODEL_ARTICLES.forEach((a, i) => expect(a.n).toBe(i + 1));
    const all = buildModelText().toLowerCase();
    for (const banned of ["reserva garantizada", "garantía", "garantizad", "respaldo", "mediación"]) expect(all).not.toContain(banned);
  });

  it("buildModelText arma secciones en mayúsculas y artículos, y deja los campos {…} para completar", () => {
    const text = buildModelText();
    expect(text).toContain("OBJETO Y PRINCIPIOS\n\nArt. 1. Objeto y aceptación");
    expect(findPlaceholders(text)).toContain("nombre_residencia");
    expect(renderPlaceholders("Silencio {hora_silencio}.")).toBe("Silencio [a definir con la residencia].");
  });
});

describe("texto del reglamento (DR14)", () => {
  it("normaliza saltos de línea, espacios finales y líneas en blanco repetidas", () => {
    expect(normalizeRegulationText("  a  \r\n\r\n\r\n\r\nb \n")).toBe("a\n\nb");
  });

  it("el hash es estable ante diferencias de formato y cambia si cambia el contenido", () => {
    expect(hashRegulationText("Hola\r\n\r\n\r\nmundo ")).toBe(hashRegulationText("Hola\n\nmundo"));
    expect(hashRegulationText("Hola mundo")).not.toBe(hashRegulationText("Hola mundo."));
    expect(hashRegulationText("x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("valida: no vacío, largo mínimo y máximo, y sin campos {…} sin completar", () => {
    expect(validateRegulationText(GOOD)).toEqual({ ok: true, value: normalizeRegulationText(GOOD) });
    expect(validateRegulationText(undefined).ok).toBe(false);
    expect(validateRegulationText("corto").ok).toBe(false);
    expect(validateRegulationText("a".repeat(MAX_REGULATION_LENGTH + 1)).ok).toBe(false);
    const pending = validateRegulationText(`${GOOD}\nArt. 2. Visitas\nSe reciben {horario_visitas}.`);
    expect(pending.ok).toBe(false);
    if (!pending.ok) expect(pending.error).toContain("{horario_visitas}");
  });

  it("el modelo entero sin completar NO se puede publicar tal cual", () => {
    expect(validateRegulationText(buildModelText()).ok).toBe(false);
  });
});
