import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

export type Step = {
  icon: string;
  /** Título corto (gancho). */
  title: string;
  /** Una frase de apoyo visible siempre. */
  hook: string;
  /** Detalle completo, dentro del expandible. */
  detail: string[];
  /** Captura real de la app (ejemplo). */
  shot?: { src: string; alt: string; w: number; h: number };
};

/**
 * Paso a paso: cada paso es un <details> nativo (teclado + sin JS). Gancho a la vista, detalle y captura
 * de ejemplo al expandir. Server Component; solo Reveal es client.
 */
export function StepsList({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative space-y-3 border-l-2 border-dashed border-line pl-6 sm:pl-8">
      {steps.map((step, i) => (
        <Reveal key={step.title} delay={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}>
          <li className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[42px] top-4 flex h-8 w-8 items-center justify-center rounded-full bg-forest font-display text-sm font-bold text-white ring-4 ring-surface sm:-left-[50px]"
            >
              {i + 1}
            </span>
            <details className="group rounded-card border border-sand-200 bg-surface transition-shadow open:shadow-card hover:shadow-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-card p-4 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 sm:gap-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-field bg-forest-tint text-forest-700">
                  <Icon name={step.icon} className="text-2xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">Paso {i + 1}: </span>
                  <span className="block font-display text-base font-bold text-ink sm:text-lg">{step.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{step.hook}</span>
                </span>
                <span className="hidden shrink-0 text-xs font-semibold text-forest-700 sm:block">
                  <span className="group-open:hidden">Ver más</span>
                  <span className="hidden group-open:inline">Cerrar</span>
                </span>
                <Icon name="expand_more" className="shrink-0 text-2xl text-forest-700 transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="benefit-fade-in grid gap-4 border-t border-sand-200 p-4 sm:p-5 md:grid-cols-[1fr_minmax(0,300px)] md:items-start">
                <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
                  {step.detail.map((t) => (
                    <p key={t}>{t}</p>
                  ))}
                </div>
                {step.shot && (
                  <figure className="relative overflow-hidden rounded-field border border-line bg-cream">
                    {/* Móvil: la captura es de desktop, así que se muestra al doble de ancho y se desliza (legible a 375). */}
                    <div className="max-md:overflow-x-auto max-md:[scrollbar-width:thin]" tabIndex={0} role="group" aria-label={`Captura de ejemplo: ${step.shot.alt}`}>
                      <Image
                        src={step.shot.src}
                        alt={step.shot.alt}
                        width={step.shot.w}
                        height={step.shot.h}
                        loading="lazy"
                        sizes="(min-width: 768px) 300px, 180vw"
                        className="h-auto w-full max-md:w-[200%] max-md:max-w-none"
                      />
                    </div>
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-cream to-transparent md:hidden" />
                    <figcaption className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">
                      Ejemplo
                    </figcaption>
                  </figure>
                )}
              </div>
            </details>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}
