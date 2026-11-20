import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * «Volver» de cada pantalla del flujo de preapertura: link con flecha, secundario (nunca compite con la acción primaria), 44 px de
 * alto y foco visible. Destino fijo y explícito (no `history.back()`): siempre lleva a la pantalla anterior del flujo, también si se
 * entró directo o en una pestaña nueva. `tone="dark"` es para encabezados forest-ink.
 */
export function BackNav({
  href,
  children = "Volver",
  tone = "light",
  className = "",
}: {
  href: string;
  children?: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const colors =
    tone === "dark"
      ? "text-white hover:text-gold focus-visible:outline-white"
      : "text-forest-700 hover:text-forest-ink focus-visible:outline-forest-ink";
  return (
    <Link
      href={href}
      className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-field px-2 text-sm font-bold underline-offset-4 hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 ${colors} ${className}`}
    >
      <Icon name="arrow_back" className="text-xl" />
      {children}
    </Link>
  );
}
