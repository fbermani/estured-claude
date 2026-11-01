import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/**
 * Remarcado visual del Plan Premium (DR17). Solo presentación: las funciones siguen andando (D8).
 * Sin "use client": se usa tanto desde Server Components como desde el sidebar.
 */

/** Etiqueta chica con candado: «Premium». */
export function PremiumTag({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-tint px-2 py-0.5 text-[11px] font-extrabold leading-4 text-orange-700 ${className}`}
    >
      <Icon name="lock" className="text-[13px]" aria-hidden />
      {compact ? <span className="sr-only">Premium</span> : "Premium"}
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
      className={`flex flex-wrap items-center gap-4 rounded-card border-[1.5px] border-orange/30 bg-orange-tint p-4 ${className}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-orange-700">
        <Icon name="lock" className="text-xl" />
      </span>
      <div className="min-w-0 flex-1 text-sm text-orange-700">
        <p className="font-extrabold">Función Premium · hoy bonificada</p>
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
