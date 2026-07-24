import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

type IconTone = "petrol" | "amber" | "sage" | "neutral";

const ICON_TONE_CLASSES: Record<IconTone, string> = {
  petrol: "bg-forest-tint text-forest-700",
  amber: "bg-orange-tint text-orange-700",
  sage: "bg-mint text-forest-700",
  neutral: "bg-cream-2 text-ink-soft",
};

/**
 * Card de acceso rápido del hub de Inicio (Ciclo 40) — dos niveles de
 * interacción sin anidar `<a>` (inválido en HTML): un link "estirado"
 * (`absolute inset-0`) cubre toda la tarjeta y navega a `href`; el CTA,
 * si se pasa uno con un destino distinto, es un link hermano posicionado
 * por encima (`z-10`) que intercepta su propio click antes de llegar al
 * link de fondo. Reusa `Card interactive` para el hover (elevación +
 * sombra, `ease-bounce`) ya establecido en el resto del sitio.
 */
export function ModuleCard({
  href,
  icon,
  iconTone = "petrol",
  title,
  badge,
  cta,
  children,
  className = "",
  animationDelayMs,
}: {
  href: string;
  icon: string;
  iconTone?: IconTone;
  title: string;
  badge?: { label: string; tone?: "neutral" | "petrol" | "sage" | "amber" | "danger" };
  cta?: { label: string; href: string };
  children?: ReactNode;
  className?: string;
  animationDelayMs?: number;
}) {
  return (
    <Card
      interactive
      className={`group benefit-fade-in relative flex flex-col gap-3 p-5 ${className}`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <Link href={href} className="absolute inset-0 z-0 rounded-card" aria-label={title}>
        <span className="sr-only">{title}</span>
      </Link>

      <div className="relative z-[1] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${ICON_TONE_CLASSES[iconTone]}`}>
            <Icon name={icon} className="text-xl" />
          </span>
          <h3 className="font-bold text-ink">{title}</h3>
        </div>
        {badge && <Badge tone={badge.tone ?? "neutral"}>{badge.label}</Badge>}
      </div>

      {children && <div className="relative z-[1] flex-1 text-sm text-ink-soft">{children}</div>}

      {cta && (
        <Link
          href={cta.href}
          className="relative z-10 mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold text-forest-700 hover:underline"
        >
          {cta.label}
          <Icon name="arrow_forward" className="text-sm" />
        </Link>
      )}

      {!cta && (
        <Icon
          name="chevron_right"
          className="absolute bottom-4 right-4 z-[1] text-lg text-ink-faint transition-transform duration-300 ease-fresh group-hover:translate-x-0.5"
        />
      )}
    </Card>
  );
}
