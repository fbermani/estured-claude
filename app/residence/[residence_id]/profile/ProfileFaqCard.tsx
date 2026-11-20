"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import type { FaqProfileSummary } from "@/lib/faq/profileSummary";
import { OWN_FAQ_ANSWER_MAX, OWN_FAQ_QUESTION_MAX, type OwnFaqItem } from "@/lib/residences/ownFaq";

const LINK_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-forest bg-paper px-5 text-sm font-bold text-forest-700 transition-colors hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-field border-[1.5px] border-line bg-cream px-4 py-3">
      <dt className="text-xs font-bold text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{value}</dd>
      {note && <dd className="mt-0.5 text-xs text-ink-soft">{note}</dd>}
    </div>
  );
}

/**
 * Tarjeta «Preguntas frecuentes» de la configuración. Las preguntas se eligen del catálogo de EstuRed en `/residence/<id>/faq` (con
 * respuestas sugeridas editables); acá se ve el estado real y se enlaza a ese selector. Si la residencia ya tenía preguntas propias
 * (sistema anterior, texto libre), se muestran en «Tus preguntas propias» para editarlas o quitarlas y se siguen publicando.
 * No hay casilleros vacíos: sumar preguntas nuevas se hace desde el catálogo.
 */
export function ProfileFaqCard({
  residenceId,
  summary,
  ownItems,
  onChangeOwn,
}: {
  residenceId: string;
  /** `null` = el catálogo no está disponible en este momento. */
  summary: FaqProfileSummary | null;
  ownItems: OwnFaqItem[];
  onChangeOwn: (next: OwnFaqItem[]) => void;
}) {
  const faqHref = `/residence/${residenceId}/faq`;
  return (
    <Card id="perfil-faq" className="p-6 max-lg:scroll-mt-14">
      <h2 className="text-lg font-bold text-ink">Preguntas frecuentes</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Elegí del catálogo de EstuRed las preguntas que se muestran en tu ficha. Cada una trae una respuesta sugerida que editás con los datos de tu residencia. Con las
        respuestas completas en la ficha, los estudiantes las leen antes de escribirte y llegan con menos dudas.
      </p>

      {summary ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Preguntas elegidas" value={`${summary.selected} de ${summary.recommended}`} note="Recomendadas" />
          <Stat label="Esenciales listas" value={`${summary.essentialReady} de ${summary.essentialTotal}`} note="Cubren lo imprescindible" />
          {summary.featured === null ? (
            <Stat label="Destacadas" value="No disponible" note="Probá de nuevo en unos minutos" />
          ) : summary.featured === 0 ? (
            <Stat label="Destacadas" value={`0 de ${summary.featuredMax}`} note={`Mostramos las primeras ${summary.featuredMax}`} />
          ) : (
            <Stat label="Destacadas" value={`${summary.featured} de ${summary.featuredMax}`} note="Se ven primero en la ficha" />
          )}
        </dl>
      ) : (
        <p role="status" className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">
          El catálogo de preguntas no está disponible en este momento. Probá de nuevo en unos minutos; si sigue pasando, avisale a Soporte.
        </p>
      )}

      <div className="mt-4">
        <a href={faqHref} className={LINK_CLASS}>
          Elegir preguntas del catálogo
          <Icon name="arrow_forward" className="text-lg" aria-hidden />
        </a>
      </div>

      {ownItems.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-sm font-bold text-ink">Tus preguntas propias</h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Las escribiste antes de que existiera el catálogo y se siguen mostrando en tu ficha. Podés editarlas o quitarlas. Para sumar preguntas nuevas, usá el catálogo.
          </p>
          <div className="mt-3 space-y-4">
            {ownItems.map((faq, i) => (
              <div key={i} className="rounded-field border-[1.5px] border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    label={`Pregunta propia ${i + 1}`}
                    value={faq.question}
                    maxLength={OWN_FAQ_QUESTION_MAX}
                    onChange={(e) => onChangeOwn(ownItems.map((f, idx) => (idx === i ? { ...f, question: e.target.value } : f)))}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => onChangeOwn(ownItems.filter((_, idx) => idx !== i))}
                    className="mt-7 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-field text-ink-faint transition-colors hover:bg-cream-2 hover:text-danger-fg"
                    aria-label={`Quitar la pregunta propia ${i + 1}`}
                  >
                    <Icon name="close" className="text-lg" />
                  </button>
                </div>
                <Textarea
                  label="Respuesta"
                  value={faq.answer}
                  maxLength={OWN_FAQ_ANSWER_MAX}
                  onChange={(e) => onChangeOwn(ownItems.map((f, idx) => (idx === i ? { ...f, answer: e.target.value } : f)))}
                  rows={2}
                  className="mt-3"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
