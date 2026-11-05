import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type SpaceItem = {
  href: string;
  icon: string;
  title: string;
  /** Dato corto a la derecha (acceso) o detalle bajo el título (pendiente). */
  value?: string;
  badge?: string;
  /** Con CTA se muestra el botón con destino propio. */
  cta?: { label: string; href: string };
  /** 0–100: barra de progreso (perfil). */
  progress?: number;
};

/**
 * «Tu espacio» / «Qué podés hacer ahora» del panel del estudiante como lista priorizada (auditoría M3): arriba lo
 * pendiente (naranja = pide acción), abajo los accesos. Server component, sin estado.
 */
export function SpaceList({ pending, links }: { pending: SpaceItem[]; links: SpaceItem[] }) {
  return (
    <div className="mt-3 space-y-3">
      {pending.length > 0 && (
        <ul className="divide-y divide-orange/25 overflow-hidden rounded-card border-[1.5px] border-orange bg-orange-tint/50">
          {pending.map((p) => (
            <li key={p.title} className="relative flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper text-orange-700">
                  <Icon name={p.icon} className="text-2xl" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {p.cta ? p.title : <Link href={p.href} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">{p.title}</Link>}
                    {p.badge && <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-orange-700">{p.badge}</span>}
                  </p>
                  {p.value && <p className="truncate text-xs text-ink-soft">{p.value}</p>}
                  {typeof p.progress === "number" && (
                    <div aria-hidden="true" className="mt-1.5 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-forest-600" style={{ width: `${p.progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
              {p.cta && (
                <Button href={p.cta.href} size="sm" className="relative z-10 self-start sm:self-auto">
                  {p.cta.label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {links.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card border-[1.5px] border-line bg-paper">
          {links.map((l) => (
            <li key={l.title}>
              <Link
                href={l.href}
                className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sand-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest-tint text-forest-700">
                  <Icon name={l.icon} className="text-xl" />
                </span>
                <span className="min-w-0 flex-1 font-semibold text-ink">{l.title}</span>
                {l.value && <span className="max-w-[55%] truncate text-xs text-ink-soft tabular-nums">{l.value}</span>}
                <Icon name="chevron_right" className="text-xl text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
