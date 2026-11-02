"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { ARRIVAL_CHECKLIST, CHECKLIST_TOTAL, countChecked } from "@/lib/arrival/checklist";
import { countdownLabel } from "@/lib/arrival/countdown";
import { buildArrivalMessage, buildWhatsAppUrl } from "@/lib/arrival/whatsappMessage";
import { toggleChecklistItemAction } from "@/app/students/dashboard/arrivalActions";

export type ArrivalGuideLink = { slug: string; title: string };

/**
 * «Tu llegada» (DR29, lote 2A): cuenta regresiva + checklist con casillas agrupado por categoría. El estudiante tilda (se guarda en DB,
 * optimista); el familiar vinculado activo lo ve en SOLO LECTURA. WhatsApp: solo botones manuales (copiar / abrir `wa.me`), nunca la API.
 * Si la migración 0068 no está aplicada (`persistent=false`) se muestra en solo lectura, sin tildes persistentes.
 */
export function ArrivalCard({
  reservationId,
  residenceName,
  startDateLabel,
  daysLeft,
  initialChecked,
  readOnly = false,
  persistent = true,
  ownerName,
  mainGuide,
  guideLinks = {},
}: {
  reservationId: string;
  residenceName: string;
  startDateLabel: string;
  daysLeft: number;
  initialChecked: string[];
  readOnly?: boolean;
  persistent?: boolean;
  /** Nombre corto del estudiante (vista del familiar). */
  ownerName?: string;
  mainGuide?: ArrivalGuideLink | null;
  /** Guías referenciadas por los ítems (clave del catálogo → guía), ya resueltas en el servidor. */
  guideLinks?: Record<string, ArrivalGuideLink>;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const locked = readOnly || !persistent;
  const done = countChecked(checked);
  const percent = Math.round((done / CHECKLIST_TOTAL) * 100);
  const headingId = `arrival-${reservationId}`;
  const message = buildArrivalMessage({ residenceName, startDateLabel, daysLeft });

  function toggle(key: string, next: boolean) {
    if (locked || pending.has(key)) return;
    setError(null);
    setPending((p) => new Set(p).add(key));
    setChecked((prev) => {
      const s = new Set(prev);
      if (next) s.add(key);
      else s.delete(key);
      return s;
    });
    startTransition(async () => {
      const res = await toggleChecklistItemAction({ reservationId, itemKey: key, checked: next });
      setPending((p) => {
        const s = new Set(p);
        s.delete(key);
        return s;
      });
      if (!res.ok) {
        setError(res.message);
        setChecked((prev) => {
          const s = new Set(prev);
          if (next) s.delete(key);
          else s.add(key);
          return s;
        });
      }
    });
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const btn =
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-[13px] font-bold text-ink hover:border-forest hover:bg-forest-tint";

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <div className="grid gap-4 p-5 md:grid-cols-[auto_1fr] md:items-center md:gap-6 md:p-6">
        <div className="flex items-center gap-3 md:block md:text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-forest-tint text-forest-700 md:mx-auto md:size-16">
            <Icon name="flight_land" className="text-[30px]!" />
          </span>
          <p className="font-display text-3xl font-extrabold leading-none text-forest-700 md:mt-2 md:text-4xl">{countdownLabel(daysLeft)}</p>
        </div>
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-extrabold text-ink">
            {ownerName ? `Llegada de ${ownerName}` : "Tu llegada"}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {residenceName} · ingreso previsto el {startDateLabel}
          </p>
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[13px] font-semibold text-ink-soft">
              <span>{readOnly ? "Progreso del checklist" : "Tu checklist"}</span>
              <span>
                {done} de {CHECKLIST_TOTAL}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Progreso del checklist de llegada"
              className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-2"
            >
              <div className="h-full rounded-full bg-forest transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {copied ? "Mensaje copiado al portapapeles" : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mainGuide && (
              <Link href={`/guias/${mainGuide.slug}`} className={btn}>
                <Icon name="menu_book" className="text-[18px]!" />
                Leer la guía para mudarte
              </Link>
            )}
            {!readOnly && (
              <>
                <button type="button" onClick={copyMessage} className={btn}>
                  <Icon name="content_copy" className="text-[18px]!" />
                  {copied ? "¡Copiado!" : "Copiar mensaje"}
                </button>
                <a href={buildWhatsAppUrl(message)} target="_blank" rel="noopener noreferrer" className={btn}>
                  <Icon name="chat" className="text-[18px]!" />
                  Abrir WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <p id={`${headingId}-locked`} className="sr-only">
        {readOnly ? "Solo lectura: el checklist lo completa el estudiante." : !persistent ? "Todavía no se pueden guardar los tildes." : ""}
      </p>
      {readOnly && (
        <p className="border-t border-line bg-cream-2 px-5 py-2.5 text-xs text-ink-soft md:px-6">
          Solo lectura: el checklist lo completa el estudiante y los ítems están escritos para él o ella.
        </p>
      )}
      {!persistent && !readOnly && (
        <p className="border-t border-line bg-cream-2 px-5 py-2.5 text-xs text-ink-soft md:px-6">
          Guardar tus tildes todavía no está disponible: el checklist se muestra solo para leer.
        </p>
      )}
      {error && (
        <p role="alert" className="border-t border-line bg-danger-bg px-5 py-2.5 text-xs font-semibold text-danger-fg md:px-6">
          {error}
        </p>
      )}

      <div className="border-t border-line">
        {ARRIVAL_CHECKLIST.map((cat, idx) => {
          const catDone = cat.items.filter((i) => checked.has(i.key)).length;
          return (
            <details key={cat.id} open={idx === 0} className="group border-b border-line last:border-b-0">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 px-5 py-2 text-sm font-bold text-ink marker:hidden hover:bg-cream-2 md:px-6 [&::-webkit-details-marker]:hidden">
                <Icon name={cat.icon} className="text-[22px]! text-forest-700" />
                <span className="flex-1">{cat.title}</span>
                <span className={`text-xs font-semibold ${catDone === cat.items.length ? "text-forest-700" : "text-ink-faint"}`}>
                  {catDone}/{cat.items.length}
                </span>
                <Icon name="expand_more" className="text-[22px]! text-ink-faint transition-transform group-open:rotate-180" />
              </summary>
              <ul className="pb-2">
                {cat.items.map((item) => {
                  const guide = item.guide ? guideLinks[item.guide] : undefined;
                  const id = `${reservationId}-${item.key}`;
                  return (
                    <li key={item.key} className="flex items-start gap-1 px-2 md:px-3">
                      <label htmlFor={id} className={`flex min-h-[44px] flex-1 items-start gap-3 rounded-field px-3 py-2.5 ${locked ? "cursor-default" : "cursor-pointer hover:bg-cream-2"}`}>
                        <input
                          id={id}
                          type="checkbox"
                          checked={checked.has(item.key)}
                          disabled={locked}
                          aria-describedby={locked ? `${headingId}-locked` : undefined}
                          onChange={(e) => toggle(item.key, e.target.checked)}
                          className="mt-0.5 size-5 shrink-0 accent-forest disabled:cursor-default"
                        />
                        <span className="min-w-0">
                          <span className={`block text-sm leading-snug ${checked.has(item.key) ? "text-ink-faint line-through" : "text-ink"}`}>{item.label}</span>
                          {item.hint && <span className="mt-0.5 block text-xs leading-snug text-ink-faint">{item.hint}</span>}
                        </span>
                      </label>
                      {guide && (
                        <Link
                          href={`/guias/${guide.slug}`}
                          aria-label={`Leer la guía: ${guide.title}`}
                          className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-forest-700 hover:bg-forest-tint"
                        >
                          <Icon name="menu_book" className="text-[20px]!" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
