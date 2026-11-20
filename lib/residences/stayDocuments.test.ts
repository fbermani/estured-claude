import { describe, expect, it } from "vitest";
import {
  computeRequirementStatuses,
  defaultStayDocumentsConfig,
  listStayRequirements,
  normalizeRequirementLabel,
  normalizeStayDocumentsInput,
  parseStayDocumentsContent,
  restrictToLegacyRequirements,
  sanitizeStayDocumentLabel,
  summarizeRequirementStatuses,
} from "@/lib/residences/stayDocuments";

describe("parseStayDocumentsContent", () => {
  it("sin sección o con forma inesperada devuelve el default (identidad y estudios)", () => {
    for (const v of [null, undefined, "x", 3, [], {}, { foo: 1 }]) {
      expect(parseStayDocumentsContent(v)).toEqual(defaultStayDocumentsConfig());
    }
    expect(defaultStayDocumentsConfig()).toEqual({ items: ["identity", "academic_proof"], other: [] });
  });

  it("descarta claves desconocidas, ordena según el catálogo y limpia los «Otro»", () => {
    const cfg = parseStayDocumentsContent({
      items: ["criminal_record", "nope", "identity", "identity"],
      other: ["  Seguro   médico ", "seguro médico", "", "<b>Visa</b>", 7],
    });
    expect(cfg.items).toEqual(["identity", "criminal_record"]);
    expect(cfg.other).toEqual(["Seguro médico", "bVisa/b", "7"]);
  });

  it("una configuración guardada vacía se respeta (no pide nada)", () => {
    expect(parseStayDocumentsContent({ items: [], other: [] })).toEqual({ items: [], other: [] });
  });

  it("recorta a 5 «Otro» y a 80 caracteres", () => {
    const cfg = parseStayDocumentsContent({ items: [], other: ["a", "b", "c", "d", "e", "f", "x".repeat(200)] });
    expect(cfg.other).toHaveLength(5);
    expect(parseStayDocumentsContent({ items: [], other: ["x".repeat(200)] }).other[0]).toHaveLength(80);
  });
});

describe("normalizeStayDocumentsInput", () => {
  it("normaliza claves y etiquetas", () => {
    const r = normalizeStayDocumentsInput(["academic_proof", "zzz", "identity"], ["  Carta  de aceptación ", "carta de aceptación"]);
    expect(r).toEqual({ ok: true, value: { items: ["identity", "academic_proof"], other: ["Carta de aceptación"] } });
  });

  it("rechaza más de 5 «Otro» y etiquetas largas", () => {
    expect(normalizeStayDocumentsInput([], ["a", "b", "c", "d", "e", "f"]).ok).toBe(false);
    expect(normalizeStayDocumentsInput([], ["x".repeat(81)]).ok).toBe(false);
    expect(normalizeStayDocumentsInput([], ["x".repeat(80)]).ok).toBe(true);
  });

  it("permite no pedir ningún documento", () => {
    expect(normalizeStayDocumentsInput([], [])).toEqual({ ok: true, value: { items: [], other: [] } });
  });
});

describe("sanitize / normalize de etiquetas", () => {
  it("quita HTML, saltos de línea y espacios de más", () => {
    expect(sanitizeStayDocumentLabel("a\n\tb  <script>")).toBe("a b script");
  });
  it("compara sin tildes ni mayúsculas", () => {
    expect(normalizeRequirementLabel("  Seguro Médico ")).toBe(normalizeRequirementLabel("seguro medico"));
  });
});

describe("computeRequirementStatuses", () => {
  const requirements = listStayRequirements({ items: ["identity", "academic_proof", "criminal_record"], other: ["Seguro médico"] });

  it("marca lo entregado y lo que falta, con la fecha más reciente", () => {
    const statuses = computeRequirementStatuses(requirements, [
      { document_type: "student_identity", created_at: "2026-10-01T10:00:00Z" },
      { document_type: "student_identity", created_at: "2026-10-05T10:00:00Z" },
      { document_type: "other", requirement_label: "seguro MEDICO", created_at: "2026-10-02T10:00:00Z" },
    ]);
    expect(statuses.map((s) => [s.requirement.id, s.delivered])).toEqual([
      ["identity", true],
      ["academic_proof", false],
      ["criminal_record", false],
      ["other:seguro medico", true],
    ]);
    expect(statuses[0].deliveredAt).toBe("2026-10-05T10:00:00Z");
    expect(summarizeRequirementStatuses(statuses)).toEqual({ total: 4, delivered: 2, missing: 2 });
  });

  it("DR48: devuelve el id del archivo más reciente que cubre cada requisito", () => {
    const statuses = computeRequirementStatuses(requirements, [
      { id: "viejo", document_type: "student_identity", created_at: "2026-10-01T10:00:00Z" },
      { id: "nuevo", document_type: "student_identity", created_at: "2026-10-05T10:00:00Z" },
      { document_type: "student_academic_proof", created_at: "2026-10-05T10:00:00Z" },
    ]);
    expect(statuses.map((s) => s.fileId)).toEqual(["nuevo", null, null, null]);
  });

  it("un archivo «other» sin etiqueta o con otra etiqueta no cubre un «Otro»", () => {
    const statuses = computeRequirementStatuses(requirements, [
      { document_type: "other", requirement_label: null },
      { document_type: "other", requirement_label: "Visa" },
    ]);
    expect(statuses[3].delivered).toBe(false);
  });

  it("sin archivos todo falta; sin requisitos no hay nada que cumplir", () => {
    expect(summarizeRequirementStatuses(computeRequirementStatuses(requirements, []))).toEqual({ total: 4, delivered: 0, missing: 4 });
    expect(summarizeRequirementStatuses(computeRequirementStatuses([], []))).toEqual({ total: 0, delivered: 0, missing: 0 });
  });
});

describe("restrictToLegacyRequirements", () => {
  it("sin la migración solo quedan identidad y estudios", () => {
    const all = listStayRequirements({ items: ["identity", "criminal_record"], other: ["Visa"] });
    expect(restrictToLegacyRequirements(all).map((r) => r.id)).toEqual(["identity"]);
  });
});
