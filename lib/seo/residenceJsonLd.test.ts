import { describe, expect, it } from "vitest";
import { residenceJsonLd } from "./residenceJsonLd";

const base = { slug: "casa-x", name: "Casa X", pricesUsd: [], amenities: [], faq: [] };
type Node = { "@type": string; priceRange?: string; geo?: { latitude: number } };
const parse = (s: string) => JSON.parse(s)["@graph"] as Node[];

describe("residenceJsonLd", () => {
  it("siempre incluye LodgingBusiness y BreadcrumbList; sin rating ni availability", () => {
    const g = parse(residenceJsonLd(base));
    expect(g.map((n) => n["@type"])).toEqual(["LodgingBusiness", "BreadcrumbList"]);
    expect(JSON.stringify(g)).not.toMatch(/aggregateRating|review|availability|Offer/);
  });
  it("priceRange con mínimo y máximo, o único valor", () => {
    expect(parse(residenceJsonLd({ ...base, pricesUsd: [450, 720.4] }))[0].priceRange).toBe("USD 450 - USD 720 por mes");
    expect(parse(residenceJsonLd({ ...base, pricesUsd: [500] }))[0].priceRange).toBe("USD 500 por mes");
    expect(parse(residenceJsonLd(base))[0].priceRange).toBeUndefined();
  });
  it("geo solo si se pasa; FAQPage solo con FAQ", () => {
    expect(parse(residenceJsonLd(base))[0].geo).toBeUndefined();
    const g = parse(residenceJsonLd({ ...base, geo: { lat: -34.6, lng: -58.4 }, faq: [{ question: "¿Hay wifi?", answer: "Sí." }] }));
    expect(g[0].geo?.latitude).toBe(-34.6);
    expect(g[2]["@type"]).toBe("FAQPage");
  });
  it("escapa < para incrustar en <script>", () => {
    expect(residenceJsonLd({ ...base, description: "a</script>b" })).not.toContain("</script>");
  });
});
