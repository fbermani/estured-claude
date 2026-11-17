import { ChapterHeading } from "@/components/residences/ficha/ChapterHeading";
import { FaqAccordion } from "@/components/residences/FaqAccordion";
import { OpenFaqButton } from "@/components/residences/ficha/FaqModal";
import { FAQ_READ_LABEL } from "@/lib/residences/fichaHero";

/** Botón de la banda: 44 px, no se parte, foco en paper sobre el fondo oscuro. */
const BAND_BTN =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full bg-paper px-5 text-[15px] font-bold text-forest-ink transition-colors duration-200 ease-out-fresh hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

/**
 * Banda de preguntas destacadas del capítulo «Preguntas que más nos hacen» (propuesta A, fase 3): fondo forest-ink, título en paper
 * y las respuestas rápidas en tarjetas paper (la primera abierta). Solo trae las destacadas (ver `lib/residences/featuredFaq.ts`).
 * La acción de la banda es «Leé las respuestas rápidas»: abre la lista completa en un modal (`FaqModalProvider`). No hay botón para
 * hacer una pregunta: el dueño quiere incentivar a leer; el formulario vive como enlace discreto al final del modal.
 */
export function FaqBand({
  headingId,
  number,
  items,
  residenceName,
}: {
  headingId: string;
  number: string;
  items: { question: string; answer: string; fromVisitor?: boolean; group?: string }[];
  residenceName: string;
}) {
  return (
    <div className="rounded-card bg-forest-ink px-4 py-6 text-paper min-[768px]:px-9 min-[768px]:py-9">
      <ChapterHeading id={headingId} number={number} tone="dark">
        Preguntas que más nos hacen
      </ChapterHeading>
      <p className="-mt-2 mb-5 text-base text-[color:var(--paper-88)]">Respondidas por {residenceName}.</p>
      <FaqAccordion items={items} onDark />
      <div className="mt-5 flex">
        <OpenFaqButton className={`${BAND_BTN} max-[479px]:w-full`}>{FAQ_READ_LABEL}</OpenFaqButton>
      </div>
    </div>
  );
}
