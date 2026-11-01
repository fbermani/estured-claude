import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "outline-forest" | "ghost";
type Size = "sm" | "md" | "lg";

/**
 * Sistema FRESH (design-references/fresh-style.md §2 "Botones"): pill,
 * font-weight 700, hover translateY(-3px) + sombra de color con
 * --ease-bounce, active translateY(1px) scale(.98). Los nombres de
 * variant/size se mantienen (usados en ~50 páginas) — lo que cambia es
 * qué clases renderiza cada uno.
 */
const base =
  "inline-flex items-center justify-center gap-2 font-bold rounded-full transition-all duration-300 ease-bounce focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50 disabled:pointer-events-none hover:-translate-y-[3px] active:translate-y-px active:scale-[0.98]";

const variants: Record<Variant, string> = {
  // btn-forest — acción principal de gestión/guardar.
  primary: "bg-forest text-white shadow-sm hover:bg-forest-600 hover:shadow-forest",
  // btn-orange — CTA principal marketing/optimista.
  secondary: "bg-orange text-white shadow-sm hover:bg-orange-600 hover:shadow-orange",
  // btn-ghost con borde — secundario.
  outline:
    "border-[1.5px] border-line-2 text-ink hover:border-forest hover:bg-forest-tint bg-paper",
  // outline con borde forest — secundario junto a un primario (ej. «Crear cuenta» en el header).
  "outline-forest":
    "border-[1.5px] border-forest text-forest-700 hover:bg-forest-tint bg-paper",
  // btn-ghost sin borde — terciario.
  ghost: "text-ink-soft hover:bg-cream-2 bg-transparent",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-5 h-[46px]",
  md: "text-sm px-6 h-12",
  lg: "text-base px-8 h-14",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
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
    className = "",
    children,
    ...rest
  } = props;
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if ("href" in rest && typeof rest.href === "string") {
    return (
      <Link href={rest.href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button {...(rest as ComponentPropsWithoutRef<"button">)} className={classes}>
      {children}
    </button>
  );
}
