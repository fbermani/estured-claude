import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { AUDIENCE_META, CATEGORY_META } from "@/lib/guides/taxonomy";
import type { GuideSummary } from "@/lib/guides/types";

/**
 * Tarjeta de guía (Server Component, indexable). Cabecera con ícono y degradé por categoría
 * (sin fotos inventadas; `heroImage` opcional). Toda la tarjeta es clickeable vía el link del título.
 */
export function GuideCard({ guide, size = "default" }: { guide: GuideSummary; size?: "default" | "featured" }) {
  const cat = CATEGORY_META[guide.category];
  const featured = size === "featured";
  return (
    <article className="group/card relative flex h-full flex-col overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card transition duration-200 ease-out-fresh hover:-translate-y-1.5 hover:shadow-card-hover has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${cat.gradient} ${featured ? "h-36 sm:h-44" : "h-28"}`}
      >
        {guide.heroImage ? (
          <Image src={guide.heroImage.src} alt={guide.heroImage.alt} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        ) : (
          <>
            <span aria-hidden="true" className="absolute -right-8 -top-10 size-36 rounded-full bg-white/40" />
            <span aria-hidden="true" className="absolute -bottom-12 left-6 size-28 rounded-full bg-white/30" />
            <Icon
              name={cat.icon}
              className={`relative transition-transform duration-500 ease-out-fresh group-hover/card:scale-110 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100 ${featured ? "text-7xl!" : "text-6xl!"}`}
            />
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Badge tone="neutral" className="font-semibold">
            <Icon name={cat.icon} className="text-sm!" />
            {cat.label}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-faint">
            <Icon name="schedule" className="text-sm!" />
            {guide.readMinutes} min de lectura
          </span>
        </div>
        <h3 className={`font-display font-bold leading-snug text-ink ${featured ? "text-xl sm:text-2xl" : "text-lg"}`}>
          <Link
            href={`/guias/${guide.slug}`}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {guide.title}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">{guide.description}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs font-semibold text-ink-faint">
          <span>{guide.audience.map((a) => AUDIENCE_META[a].label).join(", ")}</span>
          <span className="inline-flex items-center gap-1 text-forest-700">
            Leer
            <Icon name="arrow_forward" className="text-base! transition-transform duration-300 group-hover/card:translate-x-1 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </article>
  );
}
