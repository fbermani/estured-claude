import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MiniCommunityRail } from "@/components/preapertura/MiniCommunityRail";
import { buildRail } from "@/lib/preapertura/communityRail";

const rail = buildRail([]);
const html = renderToStaticMarkup(createElement(MiniCommunityRail, { cards: rail.cards, hasExamples: rail.hasExamples }));

describe("MiniCommunityRail: fichas sin rótulo (DR67)", () => {
  it("nombra la tira con el título de vista previa", () => {
    expect(html).toContain('aria-label="Así vas a ver a tus posibles compañeros"');
  });

  it("no rotula ni marca con borde punteado las fichas ficticias", () => {
    expect(html).not.toContain("Ejemplo");
    expect(html).not.toContain("border-dashed");
    expect(html).toContain("Martina");
  });
});
