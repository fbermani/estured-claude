import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Enlace de texto «Volver a la configuración» para las pantallas del panel a las que se llega desde la configuración de la residencia
 * (reglamento, preguntas, compartir, habitaciones, disponibilidad). No es una acción primaria: va como enlace discreto.
 */
export function BackToProfileLink({ residenceId, className = "" }: { residenceId: string; className?: string }) {
  return (
    <Link
      href={`/residence/${residenceId}/profile`}
      className={`inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-forest-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${className}`}
    >
      <Icon name="arrow_back" className="text-lg" aria-hidden />
      Volver a la configuración
    </Link>
  );
}
