import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Encabezado único de las secciones del panel de una residencia: fondo celeste del tono, círculo
 * decorativo y altura baja (para que el contenido quede a la vista). Server Component.
 */
export function ResidenceHero({
  icon,
  title,
  subtitle,
  actions,
  className = "mb-5",
}: {
  /** Ícono Material Symbols del rótulo superior. */
  icon: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`tone-residence relative overflow-hidden rounded-card bg-(--tone-soft) px-5 py-5 md:px-8 md:py-6 ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-[70px] size-[220px] rounded-full bg-(--tone) opacity-[0.12]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-(--tone-700)">
            <Icon name={icon} className="text-lg" aria-hidden />
            {title}
          </span>
          <h1 className="font-display text-[1.75rem] font-bold leading-[1.08] text-(--tone-ink) md:text-4xl">{title}</h1>
          {subtitle && <p className="max-w-[60ch] text-[15px] text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
