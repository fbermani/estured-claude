"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { saveFeaturedFaqAction } from "@/app/residence/[residence_id]/faq/actions";
import { useReportUnsaved } from "@/app/residence/[residence_id]/faq/FaqEditor";
import { FEATURED_FAQ_MAX } from "@/lib/residences/featuredFaq";
import type { FeaturedRef } from "@/lib/faq/featuredSelection";

export type FeaturedCandidateView = { ref: FeaturedRef; question: string; order: number | null };

const keyOf = (r: FeaturedRef) => `${r.kind}:${r.id}`;

/**
 * Elegir las preguntas destacadas de la ficha: hasta 6, con el orden que quiera la residencia. Son las que se leen de entrada en el
 * capítulo «Preguntas» (el resto queda en «Más preguntas»). Solo se ofrecen las que hoy se muestran en la ficha. Un solo botón «Guardar»;
 * la validación que vale es la del servidor. Sin ninguna elegida, la ficha destaca las primeras 6 (se dice con claridad: es el estado normal, no un error). El «Guardar destacadas» es secundario: la acción primaria de la pantalla es «Guardar todo y volver».
 */
export function FeaturedFaqManager({ residenceId, candidates }: { residenceId: string; candidates: FeaturedCandidateView[] }) {
  const initial = useMemo(
    () =>
      candidates
        .filter((c) => c.order != null)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .slice(0, FEATURED_FAQ_MAX)
        .map((c) => keyOf(c.ref)),
    [candidates],
  );
  const [order, setOrder] = useState<string[]>(initial);
  const [saved, setSaved] = useState<string[]>(initial);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const byKey = useMemo(() => new Map(candidates.map((c) => [keyOf(c.ref), c])), [candidates]);
  const dirty = order.join("|") !== saved.join("|");
  // Un orden de destacadas sin guardar frena la salida de la pantalla (se guarda con su propio botón).
  useReportUnsaved("featured", "las destacadas", dirty);
  const full = order.length >= FEATURED_FAQ_MAX;
  const others = candidates.filter((c) => !order.includes(keyOf(c.ref)));

  const move = (index: number, dir: -1 | 1) =>
    setOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const refs = order.flatMap((k) => (byKey.get(k) ? [byKey.get(k)!.ref] : []));
      const result = await saveFeaturedFaqAction(residenceId, refs);
      if (result.status === "success") {
        setSaved(order);
        setFeedback({
          tone: "success",
          text: result.count === 0 ? "Listo. Sin destacadas elegidas, tu ficha destaca las primeras 6." : "Listo, tus preguntas destacadas ya se ven en tu ficha.",
        });
      } else {
        setFeedback({ tone: "error", text: result.message });
      }
    });
  }

  const iconBtn =
    "grid size-11 place-items-center rounded-full border-[1.5px] border-line-2 bg-paper text-ink transition hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:pointer-events-none disabled:opacity-40";

  return (
    <section aria-labelledby="faq-featured-title" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="faq-featured-title" className="text-lg font-bold text-ink">
          Preguntas destacadas
        </h2>
        <span className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${full ? "bg-forest-tint text-forest-700" : "bg-cream-2 text-ink-soft"}`}>
          {order.length === 0 ? "Automáticas" : `${order.length} de ${FEATURED_FAQ_MAX}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Son las que se leen de entrada en tu ficha; el resto queda en «Más preguntas». Es opcional.
        {order.length === 0
          ? ` Hoy no elegiste ninguna: tu ficha destaca las primeras ${FEATURED_FAQ_MAX} que mostrás. Si querés decidir cuáles y en qué orden, tocá «Destacar» en una de abajo.`
          : ` Elegí hasta ${FEATURED_FAQ_MAX} entre las que ya mostrás. Si sacás todas, vuelven las automáticas.`}
      </p>

      {candidates.length === 0 ? (
        <p className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">
          Todavía no mostrás preguntas del catálogo ni respondiste preguntas de visitantes. Cuando tengas alguna, la elegís acá.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Destacadas, en este orden</h3>
            {order.length === 0 ? (
              <p className="mt-2 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">
                Sin elección tuya, la ficha usa las primeras {FEATURED_FAQ_MAX} preguntas que mostrás.
              </p>
            ) : (
              <ol className="mt-2 space-y-2">
                {order.map((key, index) => {
                  const c = byKey.get(key);
                  if (!c) return null;
                  return (
                    <li key={key} className="flex items-center gap-2 rounded-card border-[1.5px] border-line bg-paper px-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-ink text-sm font-bold text-paper tabular-nums">{index + 1}</span>
                      <span className="min-w-0 flex-1 break-words text-sm font-semibold text-ink">{c.question}</span>
                      <button type="button" className={iconBtn} disabled={index === 0 || pending} onClick={() => move(index, -1)} aria-label={`Subir «${c.question}»`}>
                        <Icon name="arrow_upward" className="text-lg" />
                      </button>
                      <button type="button" className={iconBtn} disabled={index === order.length - 1 || pending} onClick={() => move(index, 1)} aria-label={`Bajar «${c.question}»`}>
                        <Icon name="arrow_downward" className="text-lg" />
                      </button>
                      <button type="button" className={iconBtn} disabled={pending} onClick={() => setOrder((prev) => prev.filter((k) => k !== key))} aria-label={`Sacar de las destacadas «${c.question}»`}>
                        <Icon name="close" className="text-lg" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {others.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Las demás que mostrás</h3>
              {full && <p className="mt-1 text-xs text-ink-faint">Ya elegiste {FEATURED_FAQ_MAX}: sacá una destacada para sumar otra.</p>}
              <ul className="mt-2 space-y-2">
                {others.map((c) => (
                  <li key={keyOf(c.ref)} className="flex items-center gap-2 rounded-card border-[1.5px] border-line bg-cream-2/40 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words text-sm text-ink">{c.question}</span>
                    <button
                      type="button"
                      disabled={full || pending}
                      onClick={() => setOrder((prev) => [...prev, keyOf(c.ref)])}
                      aria-label={`Destacar «${c.question}»`}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-sm font-bold text-ink transition hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Icon name="star" className="text-lg" />
                      Destacar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={save} disabled={pending || !dirty}>
              {pending ? "Guardando…" : "Guardar destacadas"}
            </Button>
            {dirty && <span className="text-sm font-semibold text-warning-fg">Cambios sin guardar</span>}
          </div>
        </div>
      )}
      <p
        role={feedback?.tone === "error" ? "alert" : "status"}
        aria-live="polite"
        className={feedback ? `mt-3 rounded-field px-4 py-3 text-sm font-medium ${feedback.tone === "success" ? "bg-mint text-forest-700" : "bg-danger-bg text-danger-fg"}` : "sr-only"}
      >
        {feedback?.text ?? ""}
      </p>
    </section>
  );
}
