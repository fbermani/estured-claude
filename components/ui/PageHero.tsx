import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

/**
 * Encabezado de pantalla del kit logueado: saludo corto, estado en un pill y un único CTA principal.
 * Fondo suave del tono, círculo y glifo decorativos (aria-hidden) que reaccionan al hover.
 * Server Component. Reemplaza a `StudentGreeting`.
 */
export function PageHero({
  tone = "student",
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  status,
  cta,
  actions,
  glyph,
  className = "",
}: {
  tone?: RoleTone;
  eyebrow?: string;
  eyebrowIcon?: string;
  title: string;
  subtitle?: string;
  /** Pills de estado (p. ej. `<Badge>` o un pill propio). */
  status?: ReactNode;
  cta?: { label: string; href: string; note?: string };
  /** Alternativa a `cta` cuando la acción principal es un botón (no un link). */
  actions?: ReactNode;
  /** Nombre de ícono Material Symbols para la decoración grande de fondo. */
  glyph?: string;
  className?: string;
}) {
  return (
    <header
      className={`${toneClass(tone)} group/hero relative grid gap-4 overflow-hidden rounded-[30px] bg-(--tone-soft) px-5 py-6 md:grid-cols-[1fr_auto] md:items-end md:gap-8 md:px-9 md:py-8 ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-[70px] size-[220px] rounded-full bg-(--tone) opacity-[0.12] transition-transform duration-700 ease-out-fresh group-hover/hero:scale-[1.15]"
      />
      {glyph && (
        <Icon
          name={glyph}
          className="pointer-events-none absolute -bottom-3.5 right-4 text-[120px] leading-none text-(--tone) opacity-[0.14] md:right-52 md:text-[170px]"
        />
      )}
      <div className="relative grid gap-2.5">
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.09em] text-(--tone-700)">
            {eyebrowIcon && <Icon name={eyebrowIcon} className="text-lg" />}
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-[1.75rem] font-extrabold leading-[1.08] text-(--tone-ink) md:text-4xl">{title}</h1>
        {subtitle && <p className="max-w-[52ch] text-[15px] text-ink-soft">{subtitle}</p>}
        {status && <div className="flex flex-wrap items-center gap-2.5">{status}</div>}
      </div>
      {actions && <div className="relative flex flex-col items-stretch gap-2">{actions}</div>}
      {cta && (
        <div className="relative flex flex-col items-stretch gap-2">
          <Link
            href={cta.href}
            className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-full bg-(--tone) px-6 text-[15px] font-semibold text-white transition-all duration-300 ease-bounce hover:-translate-y-px hover:bg-(--tone-600) hover:shadow-[0_6px_16px_var(--tone-glow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) active:scale-[0.98]"
          >
            {cta.label}
            <Icon name="arrow_forward" className="text-xl" />
          </Link>
          {cta.note && <small className="text-center text-[12.5px] text-ink-soft">{cta.note}</small>}
        </div>
      )}
    </header>
  );
}
