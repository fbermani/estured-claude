import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export type Crumb = { label: string; href?: string };

/** Migas de pan semánticas (la última es la página actual). El JSON-LD equivalente lo arma la página. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Migas de pan">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-ink-soft">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.label} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-forest-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="line-clamp-1 px-1 font-semibold text-ink">
                  {c.label}
                </span>
              )}
              {!last && <Icon name="chevron_right" className="text-lg! text-ink-faint" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
