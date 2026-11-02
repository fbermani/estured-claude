import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GUIDE_STAGES } from "@/lib/guides/types";
import { STAGE_META } from "@/lib/guides/taxonomy";
import type { Guide } from "@/lib/guides/types";

/** «Empezá por acá»: una entrada por etapa del recorrido, con links a guías reales (Server Component). */
export function StartHere({ guides }: { guides: Guide[] }) {
  const stages = GUIDE_STAGES.map((stage) => ({
    stage,
    items: guides.filter((g) => g.stage === stage),
  })).filter((s) => s.items.length > 0);
  if (stages.length === 0) return null;
  return (
    <section aria-labelledby="empeza-por-aca" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionHeader
        align="left"
        eyebrow="Empezá por acá"
        title="¿En qué momento estás?"
        description="Elegí tu etapa y andá directo a la guía que más te sirve."
      />
      <h2 id="empeza-por-aca" className="sr-only">
        Empezá por acá según tu etapa
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map(({ stage, items }) => {
          const meta = STAGE_META[stage];
          return (
            <li key={stage} className="rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
              <div className="flex items-start gap-3">
                <span className="flex size-11 flex-none items-center justify-center rounded-2xl bg-forest-tint text-forest-700">
                  <Icon name={meta.icon} className="text-2xl!" />
                </span>
                <div>
                  <p className="font-display text-base font-extrabold text-ink">{meta.label}</p>
                  <p className="text-sm text-ink-soft">{meta.hint}</p>
                </div>
              </div>
              <ul className="mt-3 grid gap-1">
                {items.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/guias/${g.slug}`}
                      className="group/link flex min-h-11 items-center justify-between gap-2 rounded-field px-2 py-1.5 text-sm font-semibold text-forest-700 hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                    >
                      <span>{g.title}</span>
                      <Icon name="arrow_forward" className="flex-none text-lg! transition-transform duration-300 group-hover/link:translate-x-1 motion-reduce:transition-none" />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
