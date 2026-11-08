import { Icon } from "@/components/ui/Icon";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";

/**
 * Resumen fijo para quien NO puede solicitar desde la ficha (equipo de la residencia, menores sin familiar, familiar sin
 * estudiante vinculado, otros roles): precio «Desde» y el botón «Ver tarifas». Quien sí puede (visitante, estudiante,
 * familiar) ve en cambio el panel de solicitud (`RequestPanel`). Datos reales; sin precio no se muestra.
 */
export function FichaSummary({ fromPriceUsd, arsPerUsd }: { fromPriceUsd: number; arsPerUsd: number }) {
  return (
    <aside aria-label="Resumen de la residencia" className="hidden min-[900px]:block">
      <div className="sticky top-24 grid gap-3 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card">
        <div>
          <span className="text-[13px] text-ink-faint">Desde</span>
          <p>
            <b className="font-display text-3xl font-bold tracking-tight text-ink tabular-nums">{formatUsd(fromPriceUsd)}</b>{" "}
            <span className="text-[13px] text-ink-faint">/mes</span>
          </p>
          <p className="flex items-center gap-0.5 text-[12.5px] tabular-nums text-ink-faint">
            ≈ {formatArs(usdToArsRounded(fromPriceUsd, arsPerUsd))}
            <ExchangeRateNote compact />
          </p>
        </div>
        <a
          href="#tarifas"
          className="flex min-h-12 items-center justify-center gap-1 rounded-full bg-forest px-5 text-[15px] font-bold text-white shadow-card transition-[background-color,transform] duration-150 ease-out-fresh motion-safe:active:scale-[0.97] hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Ver tarifas
          <Icon name="arrow_downward" className="text-lg" />
        </a>
        <p className="text-center text-xs leading-relaxed text-ink-faint">
          La residencia responde en hasta 48 horas. Toda reserva está sujeta a confirmación.
        </p>
      </div>
    </aside>
  );
}

/** Barra inferior fija para pantallas de menos de 900 px: precio «Desde» y acceso a tarifas. Respeta el área segura del iPhone. */
export function FichaMobileBar({ fromPriceUsd }: { fromPriceUsd: number }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line-2 bg-paper/95 px-4 pt-2.5 shadow-[0_-6px_18px_rgba(29,39,34,0.08)] backdrop-blur pb-[max(0.625rem,env(safe-area-inset-bottom))] min-[900px]:hidden">
      <p className="leading-none">
        <span className="block text-[12px] text-ink-faint">Desde</span>
        <b className="font-display text-[22px] font-bold tabular-nums text-ink">{formatUsd(fromPriceUsd)}</b>{" "}
        <span className="text-[13px] text-ink-faint">/mes</span>
      </p>
      <a
        href="#tarifas"
        className="flex min-h-11 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white shadow-card hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Ver tarifas
      </a>
    </div>
  );
}
