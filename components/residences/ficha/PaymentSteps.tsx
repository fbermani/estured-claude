import { PAYMENT_STEPS, PAYMENT_STEPS_NOTE } from "@/lib/residences/fichaCosts";

/**
 * «Cómo y cuándo pagás»: los tres pasos del recorrido (hoy, si la residencia confirma, cada mes) como línea de tiempo. Componente
 * estático y reutilizable (también sirve para el formulario de solicitud). Desde 700 px es horizontal, en tres columnas iguales unidas
 * por un riel; en móvil pasa a vertical, con el riel a la izquierda. El riel es solo decorativo (`aria-hidden`): el orden lo da la lista.
 * Los textos viven en `lib/residences/fichaCosts.ts` (aprobados por el dueño).
 */
export function PaymentSteps({ showNote = true, headingId }: { showNote?: boolean; headingId?: string }) {
  return (
    <div>
      <h3 id={headingId} className="font-display text-xl font-bold text-ink">
        Cómo y cuándo pagás
      </h3>
      <ol role="list" className="mt-4 grid list-none p-0 min-[700px]:grid-cols-3 min-[700px]:gap-6">
        {PAYMENT_STEPS.map((step, i) => {
          const last = i === PAYMENT_STEPS.length - 1;
          return (
            <li key={step.title} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0 min-[700px]:block min-[700px]:pb-0">
              <span
                aria-hidden="true"
                className="relative z-10 grid size-7 place-items-center rounded-full bg-forest-ink text-sm font-bold tabular-nums text-paper"
              >
                {i + 1}
              </span>
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute left-[13px] top-8 bottom-0 w-0.5 bg-forest-700/35 min-[700px]:bottom-auto min-[700px]:left-10 min-[700px]:top-[13px] min-[700px]:h-0.5 min-[700px]:w-auto min-[700px]:-right-4"
                />
              )}
              <div className="min-w-0 min-[700px]:mt-3">
                <p className="font-bold text-ink">{step.title}</p>
                <p className="text-[15px] leading-snug text-ink-soft">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {showNote && <p className="mt-5 text-[13px] leading-snug text-ink-faint">{PAYMENT_STEPS_NOTE}</p>}
    </div>
  );
}
