import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Remarcado visual del Plan Premium (DR17). Solo presentación: las funciones siguen andando (D8).
 * Sin "use client": se usa tanto desde Server Components como desde el sidebar.
 */

/** Candado neutro (el naranja queda para lo urgente): `compact`/por defecto solo ícono; el texto va para lectores de pantalla. */
export function PremiumTag({ className = "" }: { className?: string; compact?: boolean }) {
  return (
    <span title="Plan Premium" className={`inline-flex shrink-0 items-center text-ink-faint ${className}`}>
      <Icon name="lock" className="text-base" aria-hidden />
      <span className="sr-only">Premium</span>
    </span>
  );
}

/** Aviso «Función Premium · hoy bonificada» con CTA al comparador de planes. */
export function PremiumNotice({
  residenceId,
  feature,
  className = "",
}: {
  residenceId: string;
  /** Nombre de la función de la pantalla actual, p. ej. «Renovaciones». */
  feature: string;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={`flex flex-wrap items-center gap-4 rounded-card border-[1.5px] border-line bg-sand-50 p-4 ${className}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-ink-faint">
        <Icon name="lock" className="text-xl" />
      </span>
      <div className="min-w-0 flex-1 text-sm text-ink-soft">
        <p className="font-extrabold text-ink">Función Premium · hoy bonificada</p>
        <p className="mt-0.5">
          {feature} es parte de la Gestión Operativa del Plan Premium.
        </p>
      </div>
      <Link
        href={`/residence/${residenceId}/plan`}
        className="shrink-0 rounded-full bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Ver planes
      </Link>
    </div>
  );
}
