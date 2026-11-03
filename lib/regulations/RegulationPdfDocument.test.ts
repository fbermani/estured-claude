import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { RegulationPdfDocument } from "@/lib/regulations/RegulationPdfDocument";
import { buildModelText } from "@/lib/regulations/modelTemplate";

describe("RegulationPdfDocument", () => {
  it("genera un PDF válido con el modelo base (títulos, artículos y campos sin completar)", async () => {
    const buffer = await renderToBuffer(
      RegulationPdfDocument({ residenceName: "Residencia Norte", text: buildModelText(), versionNumber: null, isBaseModel: true }),
    );
    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("genera un PDF válido con un reglamento propio con viñetas", async () => {
    const text = "CONVIVENCIA\n\nArt. 1. Silencio\nDe 23 a 7 h.\n- Sin música alta\n- Sin visitas nocturnas\n\nUn párrafo suelto.";
    const buffer = await renderToBuffer(
      RegulationPdfDocument({ residenceName: "Residencia Sur", text, versionNumber: 3, isBaseModel: false }),
    );
    expect(buffer.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
