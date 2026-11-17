import { ChapterHeading } from "@/components/residences/ficha/ChapterHeading";
import { FaqAccordion } from "@/components/residences/FaqAccordion";
import { OpenFaqButton } from "@/components/residences/ficha/FaqModal";
import { Icon } from "@/components/ui/Icon";
import { FAQ_READ_LABEL } from "@/lib/residences/fichaHero";
import { faqBandFooter } from "@/lib/residences/featuredFaq";

/** Pill de la banda: 48 px, paper sobre forest-ink (≥ 12:1), no se parte, foco en paper con el fondo oscuro de la banda. */
const BAND_BTN =
  "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-paper px-6 text-base font-bold text-forest-ink transition-colors duration-200 ease-out-fresh hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper max-[479px]:w-full";

/**
 * Banda de preguntas destacadas del capítulo «Preguntas que más nos hacen» (propuesta A, mockup aprobado): fondo forest-ink, número y título,
 * «Respondidas por …», las respuestas rápidas en tarjetas paper con el «+» que gira (la primera abierta) y, al pie, una línea de texto a la
 * izquierda y el pill «Leé las respuestas rápidas» a la derecha, que abre la lista completa en un modal (`FaqModalProvider`). Solo trae las
 * destacadas (ver `lib/residences/featuredFaq.ts`); `total` = todas las preguntas respondidas de la ficha. No hay botón para hacer una
 * pregunta: el dueño quiere incentivar a leer; el formulario vive como enlace discreto al final del modal.
 */
export function FaqBand({
  headingId,
  number,
  items,
  total,
  residenceName,
}: {
  headingId: string;
  number: string;
  items: { question: string; answer: string; fromVisitor?: boolean; group?: string }[];
  total: number;
  residenceName: string;
}) {
  const footer = faqBandFooter(total, items.length);
  return (
    <div className="rounded-card bg-forest-ink px-4 py-6 text-paper min-[768px]:px-9 min-[768px]:py-9">
      <ChapterHeading id={headingId} number={number} tone="dark">
        Preguntas que más nos hacen
      </ChapterHeading>
      <p className="-mt-2 mb-5 text-base text-[color:var(--paper-88)]">Respondidas por {residenceName}.</p>
      <FaqAccordion items={items} onDark />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-[15px] text-[color:var(--paper-88)]">{footer.text}</p>
        {footer.showReadButton && (
          <OpenFaqButton className={BAND_BTN}>
            {FAQ_READ_LABEL}
            <Icon name="arrow_forward" className="text-xl" />
          </OpenFaqButton>
        )}
      </div>
    </div>
  );
}
