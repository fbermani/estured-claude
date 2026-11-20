import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./button-cta.css";

type Variant = "primary" | "secondary" | "cta" | "outline" | "outline-forest" | "outline-dark" | "ghost";
type Size = "sm" | "md" | "lg" | "cta" | "cta-bar";

/**
 * Sistema FRESH (design-references/fresh-style.md §2 "Botones"): pill,
 * font-weight 700, hover translateY(-2px) + sombra de color con
 * --ease-out-fresh (200ms), active translateY(1px) scale(.98). Los nombres de
 * variant/size se mantienen (usados en ~50 páginas) — lo que cambia es
 * qué clases renderiza cada uno.
 */
const base =
  "inline-flex items-center justify-center gap-2 sm:whitespace-nowrap font-bold rounded-full transition duration-200 ease-out-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--btn-focus,var(--color-forest))] disabled:opacity-50 disabled:pointer-events-none motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-px motion-safe:active:scale-[0.97] motion-safe:active:duration-[140ms]";

const variants: Record<Variant, string> = {
  // btn-forest — acción principal de gestión/guardar.
  primary: "bg-forest text-white shadow-sm hover:bg-forest-600 hover:shadow-forest",
  // btn-orange — CTA principal marketing/optimista.
  secondary: "bg-orange text-white shadow-sm hover:bg-orange-600 hover:shadow-orange",
  // CTA de conversión de la ficha (propuesta A): naranja de marca con texto paper (4,70:1, AA), sombra de color, brillo al hover y,
  // con `pulse`, un halo cada ~4 s. Pensado para UNA sola acción por pantalla; usar con size="cta" (56 px) o "cta-bar" (52 px).
  cta: "btn-cta bg-orange text-paper hover:bg-orange-600",
  // btn-ghost con borde — secundario.
  outline:
    "border-[1.5px] border-line-2 text-ink hover:border-forest hover:bg-forest-tint bg-paper",
  // outline con borde forest — secundario junto a un primario (ej. «Crear cuenta» en el header).
  "outline-forest":
    "border-[1.5px] border-forest text-forest-700 hover:bg-forest-tint bg-paper",
  // contorno sobre fondo oscuro (heros forest-ink): borde blanco 55% (>=4:1), foco blanco.
  "outline-dark":
    "border-[1.5px] border-white/55 bg-transparent text-white hover:bg-white/10 [--btn-focus:#fff]",
  // btn-ghost sin borde — terciario.
  ghost: "text-ink-soft hover:bg-cream-2 bg-transparent",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-5 h-[46px]",
  md: "text-sm px-6 h-12",
  lg: "text-base px-8 h-14",
  cta: "text-[17px] px-7 h-14",
  "cta-bar": "text-base px-5 h-[52px]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** Solo para `variant="cta"`: halo que late cada ~4 s (quieto con prefers-reduced-motion). Una sola CTA por pantalla. */
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonProps = CommonProps &
  ComponentPropsWithoutRef<"button"> & { href?: undefined };
type LinkProps = CommonProps & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const {
    variant = "primary",
    size = "md",
    pulse = false,
    className = "",
    children,
    ...rest
  } = props;
  const isCta = variant === "cta";
  const classes = `${base} ${variants[variant]} ${isCta && pulse ? "btn-cta--pulse" : ""} ${sizes[size]} ${className}`;
  // La CTA lleva el brillo del hover como capa decorativa y el texto por encima.
  const content = isCta ? (
    <>
      <span aria-hidden="true" className="btn-cta__shine" />
      <span className="relative inline-flex items-center justify-center gap-2">{children}</span>
    </>
  ) : (
    children
  );

  if ("href" in rest && typeof rest.href === "string") {
    return (
      <Link href={rest.href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button {...(rest as ComponentPropsWithoutRef<"button">)} className={classes}>
      {content}
    </button>
  );
}
