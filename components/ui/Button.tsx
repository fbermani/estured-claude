import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol-600 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-petrol-600 text-white shadow-sm hover:bg-petrol-700 hover:shadow",
  secondary:
    "bg-amber-soft-400 text-petrol-900 shadow-sm hover:bg-amber-soft-300",
  outline:
    "border border-petrol-200 text-petrol-700 hover:border-petrol-300 hover:bg-petrol-50 bg-surface",
  ghost: "text-petrol-700 hover:bg-petrol-50 bg-transparent",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-4 py-1.5",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-7 py-3",
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
