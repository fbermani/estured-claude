import { ChapterHeading } from "@/components/residences/ficha/ChapterHeading";
import { FaqAccordion } from "@/components/residences/FaqAccordion";
import { OpenFaqButton } from "@/components/residences/ficha/FaqModal";
import { seeAllFaqLabel } from "@/lib/residences/fichaHero";

/** Botones de la banda: 44 px, no se parten, foco en paper sobre el fondo oscuro. */
const BAND_BTN =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-4 text-[15px] font-bold transition-colors duration-200 ease-out-fresh focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Banda de preguntas destacadas del capítulo «Preguntas que más nos hacen» (propuesta A, fase 3): fondo forest-ink, título en paper
 * y las respuestas rápidas en tarjetas paper (la primera abierta). Solo trae las destacadas (ver `lib/residences/featuredFaq.ts`); si
 * la residencia tiene más (`totalCount`), el botón «Ver todas las preguntas (N)» abre la lista completa en un modal (`FaqModalProvider`).
 * `askHref`: ancla del formulario «Hacer una pregunta» (se omite para el equipo de la propia residencia, que responde desde su panel).
 */
export function FaqBand({
  headingId,
  number,
  items,
  totalCount,
  residenceName,
  askHref,
}: {
  headingId: string;
  number: string;
  items: { question: string; answer: string; fromVisitor?: boolean; group?: string }[];
  /** Todas las preguntas de la residencia (destacadas y resto): es el N del botón que abre la lista completa. */
  totalCount: number;
  residenceName: string;
  askHref?: string;
}) {
  return (
    <div className="rounded-card bg-forest-ink px-4 py-6 text-paper min-[768px]:px-9 min-[768px]:py-9">
      <ChapterHeading id={headingId} number={number} tone="dark">
        Preguntas que más nos hacen
      </ChapterHeading>
      <p className="-mt-2 mb-5 text-base text-[color:var(--paper-88)]">Respondidas por {residenceName}.</p>
      <FaqAccordion items={items} onDark />
      {(askHref || totalCount > items.length) && (
        <div className="mt-5 flex flex-col gap-3 min-[768px]:flex-row min-[768px]:items-center min-[768px]:justify-between">
          {askHref && (
            <p className="text-[15px] text-[color:var(--paper-88)]">¿No está tu pregunta? Hacela acá: si la residencia la responde, la ves en la ficha.</p>
          )}
          <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:flex-wrap min-[768px]:shrink-0 min-[768px]:justify-end">
            {totalCount > items.length && (
              <OpenFaqButton className={`${BAND_BTN} bg-paper text-forest-ink hover:bg-cream-2`}>{seeAllFaqLabel(totalCount)}</OpenFaqButton>
            )}
            {askHref && (
              <a href={askHref} className={`${BAND_BTN} border-[1.5px] border-paper text-paper hover:bg-[color:var(--paper-16)]`}>
                Hacer una pregunta
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
