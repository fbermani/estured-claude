import type { ReactNode } from "react";

/**
 * Cierre de la ficha, después del último capítulo: «¿Te ves viviendo acá?» sobre forest-ink, con la misma CTA naranja del hero y la
 * barra móvil (`cta`, que va dentro de `ReservationSelectionProvider`). SIN halo de pulso: en cada pantalla late una sola CTA (la del
 * hero en escritorio, la barra en móvil). El texto no promete lugar: la solicitud queda sujeta a confirmación de la residencia.
 */
export function ClosingCta({ description, cta }: { description: string; cta: ReactNode }) {
  return (
    <section
      aria-labelledby="h-cierre"
      className="mt-12 flex flex-col items-start gap-5 rounded-card bg-forest-ink px-5 py-7 text-paper min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between min-[768px]:gap-8 min-[768px]:px-9 min-[768px]:py-9"
    >
      <div className="min-w-0">
        <h2 id="h-cierre" className="font-display text-3xl font-bold leading-[1.05] min-[768px]:text-4xl">
          ¿Te ves viviendo acá?
        </h2>
        <p className="mt-2 max-w-[46ch] text-base text-[color:var(--paper-88)]">{description}</p>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 max-[767px]:w-full max-[767px]:[&>a]:w-full max-[767px]:[&>button]:w-full">{cta}</div>
    </section>
  );
}
