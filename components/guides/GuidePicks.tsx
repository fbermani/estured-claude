import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GuideCard } from "@/components/guides/GuideCard";
import { resolveGuides } from "@/lib/guides/picks";
import { CATEGORY_META } from "@/lib/guides/taxonomy";

type Variant = "strip" | "cards" | "link" | "panel";

/**
 * Enlaces contextuales a guías (Server Component). Resuelve claves («01», «R01»), ids o slugs con el
 * loader; si ninguna existe no renderiza nada. Variantes:
 * - `strip`: una línea discreta con 1–3 enlaces.
 * - `link`: texto corrido con enlace(s), sin ícono ni caja (para páginas con pocos CTAs).
 * - `panel`: tarjeta compacta con lista de lecturas (dashboards).
 * - `cards`: 2–3 tarjetas completas.
 */
export function GuidePicks({
  keys,
  variant = "strip",
  label,
  title,
  className = "",
  mobileSingle = false,
}: {
  keys: string[];
  variant?: Variant;
  /** Texto corto que antecede a los enlaces (strip/link). */
  label?: string;
  /** Título del panel/cards. */
  title?: string;
  className?: string;
  /** `strip` en móvil: una sola línea con la primera guía (el resto aparece desde `sm`). */
  mobileSingle?: boolean;
}) {
  const guides = resolveGuides(keys);
  if (guides.length === 0) return null;

  if (variant === "cards") {
    return (
      <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
        {guides.map((g) => (
          <GuideCard key={g.id} guide={g} />
        ))}
      </div>
    );
  }

  if (variant === "link") {
    return (
      <p className={`text-sm text-ink-soft ${className}`}>
        {label ? `${label} ` : ""}
        {guides.map((g, i) => (
          <span key={g.id}>
            {i > 0 && ", "}
            <Link href={`/guias/${g.slug}`} className="font-bold text-forest-700 underline-offset-2 hover:underline">
              {g.title}
            </Link>
          </span>
        ))}
      </p>
    );
  }

  if (variant === "panel") {
    return (
      <section aria-label={title ?? "Guías"} className={`rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card sm:p-5 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon name="menu_book" className="text-lg text-forest-700" />
            {title ?? "Guías para leer"}
          </h2>
          <Link href="/guias" className="text-xs font-bold text-forest-700 hover:underline">
            Ver todas
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {guides.map((g) => (
            <li key={g.id}>
              <Link href={`/guias/${g.slug}`} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-field ${CATEGORY_META[g.category].tile}`}>
                  <Icon name={CATEGORY_META[g.category].icon} className="text-xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-snug text-ink group-hover:underline">{g.title}</span>
                  <span className="block text-xs text-ink-faint">{g.readMinutes} min de lectura</span>
                </span>
                <Icon name="arrow_forward" className="shrink-0 text-lg text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <p
      className={`flex items-center gap-x-2 gap-y-1 rounded-field bg-forest-tint/50 px-3.5 py-2 text-xs text-ink-soft sm:text-[13px] ${mobileSingle ? "max-sm:flex-nowrap" : ""} flex-wrap ${className}`}
    >
      <Icon name="menu_book" className="text-base text-forest-700" />
      {label && <span className="font-semibold text-ink">{label}</span>}
      {guides.map((g, i) => (
        <span
          key={g.id}
          className={
            mobileSingle
              ? `${i > 0 ? "max-sm:hidden " : "max-sm:min-w-0 max-sm:flex-1 "}inline-flex items-center gap-2 sm:w-auto`
              : "inline-flex w-full items-center gap-2 pl-6 sm:w-auto sm:pl-0"
          }
        >
          {i > 0 && <span aria-hidden="true" className="hidden text-ink-faint sm:inline">·</span>}
          <Link href={`/guias/${g.slug}`} className={`font-bold text-forest-700 underline-offset-2 hover:underline ${mobileSingle ? "max-sm:truncate" : ""}`}>
            {g.title}
          </Link>
        </span>
      ))}
    </p>
  );
}
