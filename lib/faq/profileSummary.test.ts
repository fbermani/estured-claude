import { describe, expect, it } from "vitest";
import { ESSENTIAL_FAQ_IDS, FICHA_FAQ_VISIBLE } from "@/lib/faq/catalog";
import { buildFaqProfileSummary } from "@/lib/faq/profileSummary";
import { FEATURED_FAQ_MAX } from "@/lib/residences/featuredFaq";

const entry = (id: string, selected: boolean, owner: "estured" | "residence" = "estured", answer = "Texto") => ({
  id,
  owner,
  suggested_answer: answer,
  selection: selected ? { is_selected: true, answer_override: null } : null,
});

describe("buildFaqProfileSummary", () => {
  it("catálogo no disponible = null (la tarjeta dice «no disponible», no ceros)", () => {
    expect(buildFaqProfileSummary({ ok: false }, { ok: true, candidates: [] })).toBeNull();
  });
  it("cuenta elegidas, esenciales listas y destacadas por separado", () => {
    const entries = [entry(ESSENTIAL_FAQ_IDS[0], true), entry(ESSENTIAL_FAQ_IDS[1], true, "residence", "Dato {pendiente}"), entry("FAQ-99", true), entry("FAQ-98", false)];
    const s = buildFaqProfileSummary({ ok: true, entries }, { ok: true, candidates: [{ order: 1 }, { order: null }, { order: 2 }] });
    expect(s).toEqual({
      selected: 3,
      recommended: FICHA_FAQ_VISIBLE,
      essentialReady: 1,
      essentialTotal: ESSENTIAL_FAQ_IDS.length,
      featured: 2,
      featuredMax: FEATURED_FAQ_MAX,
    });
  });
  it("destacadas sin poder leerse = null, no 0", () => {
    expect(buildFaqProfileSummary({ ok: true, entries: [] }, { ok: false })?.featured).toBeNull();
  });
  it("sin nada elegido da ceros reales", () => {
    const s = buildFaqProfileSummary({ ok: true, entries: [entry("FAQ-99", false)] }, { ok: true, candidates: [] });
    expect(s).toMatchObject({ selected: 0, essentialReady: 0, featured: 0 });
  });
});
