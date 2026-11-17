import { ChapterHeading } from "@/components/residences/ficha/ChapterHeading";
import { FaqAccordion } from "@/components/residences/FaqAccordion";

/**
 * Banda de preguntas destacadas del capítulo «Preguntas que más nos hacen» (propuesta A, fase 3): fondo forest-ink, título en paper
 * y las respuestas rápidas en tarjetas paper (la primera abierta). El resto de las preguntas de la residencia se muestra debajo, en el
 * acordeón normal del capítulo; esta banda solo destaca las primeras (ver `lib/residences/featuredFaq.ts`).
 * `askHref`: ancla del formulario «Hacer una pregunta» (se omite para el equipo de la propia residencia, que responde desde su panel).
 */
export function FaqBand({
  headingId,
  number,
  items,
  residenceName,
  askHref,
}: {
  headingId: string;
  number: string;
  items: { question: string; answer: string; fromVisitor?: boolean }[];
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
      {askHref && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-[color:var(--paper-88)]">¿No está tu pregunta? Hacela acá: si la residencia la responde, la ves en la ficha.</p>
          <a
            href={askHref}
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-[1.5px] border-paper px-4 text-[15px] font-bold text-paper transition-colors duration-200 ease-out-fresh hover:bg-[color:var(--paper-16)]"
          >
            Hacer una pregunta
          </a>
        </div>
      )}
    </div>
  );
}
