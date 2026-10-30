import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

/**
 * Tarjeta de módulo / acción del kit logueado. Dos niveles de interacción sin anidar `<a>`: un link «estirado»
 * cubre la tarjeta y navega a `href`; el CTA, si lleva otro destino, es un link hermano por encima (`z-10`).
 * Hover/foco: sube 4 px, se dibuja la barra superior del tono y el ícono rota. Con `attention` se tiñe de naranja
 * (algo pide tu atención); con `disabledReason` queda inerte y explica por qué.
 */
export function ModuleCard({
  href,
  icon,
  title,
  tone,
  attention = false,
  disabledReason,
  badge,
  cta,
  children,
  className = "",
}: {
  href: string;
  icon: string;
  title: string;
  tone?: RoleTone;
  attention?: boolean;
  disabledReason?: string;
  badge?: { label: string; tone?: "neutral" | "petrol" | "sage" | "amber" | "danger" };
  cta?: { label: string; href: string };
  children?: ReactNode;
  className?: string;
}) {
  const disabled = Boolean(disabledReason);
  return (
    <div
      aria-disabled={disabled || undefined}
      className={`${toneClass(tone)} group relative flex h-full flex-col gap-2.5 overflow-hidden rounded-card border p-[18px] shadow-card transition-all duration-300 ease-bounce ${
        disabled
          ? "border-line bg-paper opacity-70 shadow-none"
          : `hover:-translate-y-1 hover:shadow-card-hover focus-within:-translate-y-1 focus-within:shadow-card-hover ${
              attention ? "border-orange bg-gradient-to-b from-orange-tint to-paper to-70%" : "border-line bg-paper"
            }`
      } ${className}`}
    >
      {!disabled && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-(--tone) transition-transform duration-500 ease-out-fresh group-hover:scale-x-100 group-focus-within:scale-x-100"
          />
          <Link
            href={href}
            className="absolute inset-0 z-0 rounded-card focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
            aria-label={title}
          >
            <span className="sr-only">{title}</span>
          </Link>
        </>
      )}

      <div className="relative z-[1] flex items-center gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] transition-all duration-300 ease-bounce ${
            attention ? "bg-paper text-orange-700" : "bg-(--tone-tint) text-(--tone-700)"
          } ${disabled ? "" : "group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-(--tone) group-hover:text-white"}`}
        >
          <Icon name={icon} className="text-2xl" />
        </span>
        <h3 className="min-w-0 flex-1 font-display text-[16.5px] font-bold leading-tight text-ink">{title}</h3>
        {badge && <Badge tone={badge.tone ?? "neutral"} className="shrink-0">{badge.label}</Badge>}
      </div>

      {children && <div className="relative z-[1] flex-1 text-[13.5px] text-ink-soft">{children}</div>}

      {disabled && (
        <p className="relative z-[1] inline-flex items-center gap-1 text-[13px] font-semibold text-ink-faint">
          <Icon name="lock" className="text-base" />
          {disabledReason}
        </p>
      )}

      {!disabled && cta && (
        <Link
          href={cta.href}
          className={`relative z-10 mt-auto inline-flex min-h-6 w-fit items-center gap-1 text-[13.5px] font-semibold hover:underline ${
            attention ? "text-orange-700" : "text-(--tone-700)"
          }`}
        >
          {cta.label}
          <Icon name="arrow_forward" className="text-lg transition-transform duration-300 ease-bounce group-hover:translate-x-1" />
        </Link>
      )}

      {!disabled && !cta && (
        <Icon
          name="arrow_forward"
          className="relative z-[1] mt-auto w-fit text-lg text-(--tone-700) transition-transform duration-300 ease-bounce group-hover:translate-x-1"
        />
      )}
    </div>
  );
}
