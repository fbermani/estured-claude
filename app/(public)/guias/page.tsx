import type { Metadata } from "next";
import { GuideCard } from "@/components/guides/GuideCard";
import { GuidesHub, type HubItem } from "@/components/guides/GuidesHub";
import { StartHere } from "@/components/guides/StartHere";
import { normalizeSearch } from "@/lib/guides/search";
import { getAllGuides, toSummary } from "@/lib/guides/load";
import { CATEGORY_META } from "@/lib/guides/taxonomy";

const DESCRIPTION =
  "Guías para elegir una residencia estudiantil, mudarte a Buenos Aires, convivir mejor y acompañar a quien estudia. Recursos gratuitos para estudiantes, familias y residencias.";

export const metadata: Metadata = {
  title: "Centro de Guías",
  description: DESCRIPTION,
  alternates: { canonical: "/guias" },
  openGraph: {
    type: "website",
    siteName: "EstuRed",
    locale: "es_AR",
    url: "/guias",
    title: "Centro de Guías | EstuRed",
    description: DESCRIPTION,
  },
};

export default function GuiasPage() {
  const guides = getAllGuides();
  const items: HubItem[] = guides.map((g) => ({
    id: g.id,
    category: g.category,
    audience: g.audience,
    featured: g.featured,
    search: normalizeSearch([g.title, g.description, CATEGORY_META[g.category].label, ...g.tags, ...g.sections.map((s) => s.heading)].join(" ")),
  }));
  const cards: Record<string, React.ReactNode> = {};
  const featuredCards: Record<string, React.ReactNode> = {};
  for (const g of guides) {
    cards[g.id] = <GuideCard guide={toSummary(g)} />;
    if (g.featured) featuredCards[g.id] = <GuideCard guide={toSummary(g)} size="featured" />;
  }
  return <GuidesHub items={items} cards={cards} featuredCards={featuredCards} startHere={<StartHere guides={guides} />} />;
}
