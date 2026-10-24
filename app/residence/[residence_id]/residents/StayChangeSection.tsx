"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import type { ResidenceStayChangeItem } from "@/lib/stayChange/load";
import { arDateOf, buildPlanningSummary, responseBadge, tidyShortName, timeAgoLabel } from "@/lib/stayChange/ui";

/**
 * Sección destacada "N residentes buscan cambiar" (SPEC §5.1; `docs/08` §7.12). Una fila por aviso: quién, cuándo avisó,
 * salida estimada, estado de la respuesta y la acción. Los avisos resueltos se ven atenuados con "Registrar salida".
 * El pie de planificación se calcula solo de avisos abiertos con fecha estimada; no cambia la disponibilidad.
 */
export function StayChangeSection({
  residenceId,
  items,
  onRespond,
  onRegisterExit,
}: {
  residenceId: string;
  items: ResidenceStayChangeItem[];
  onRespond: (item: ResidenceStayChangeItem) => void;
  onRegisterExit: (item: ResidenceStayChangeItem) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (items.length === 0) return null;
  const open = items.filter((i) => i.status === "open");
  const resolved = items.filter((i) => i.status === "resolved_new_reservation");

  const planning = buildPlanningSummary(open.map((i) => ({ roomTypeName: i.roomTypeName, estimatedExitDate: i.estimatedExitDate })));
  const ordered = [...open, ...resolved];

  return (
    <section
      id="buscan-cambiar"
      aria-labelledby="stay-change-section-title"
      className="mt-6 scroll-mt-24 overflow-hidden rounded-card border-[1.5px] border-orange/30 bg-paper shadow-card"
    >
      <header className="bg-gradient-to-br from-orange-tint to-paper px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-orange-700 shadow-sm">
              <Icon name="swap_horiz" className="text-xl" />
            </span>
            <div className="min-w-0">
              <h2 id="stay-change-section-title" className="font-display text-xl font-extrabold text-ink">
                {open.length === 0 ? "Avisos de cambio cerrados" : open.length === 1 ? "1 residente busca cambiar" : `${open.length} residentes buscan cambiar`}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                Te avisaron con tiempo que están buscando otro lugar. Respondé con los costos, las condiciones y los detalles de la salida: así deciden con
                información clara y vos planificás la plaza.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            aria-controls="stay-change-help"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            ¿Cómo funciona?
          </button>
        </div>
        {helpOpen && (
          <div id="stay-change-help" className="mt-4 grid gap-3 rounded-field bg-paper/80 p-4 text-xs leading-relaxed text-ink-soft sm:grid-cols-3">
            <p>
              <strong className="block text-ink">Previsibilidad</strong> Te enterás con tiempo, no el día que se van, y planificás la plaza y las renovaciones.
            </p>
            <p>
              <strong className="block text-ink">Costos por escrito</strong> Comunicás depósito, preaviso y entrega antes de que decidan. Es informativo: no
              reemplaza el contrato.
            </p>
            <p>
              <strong className="block text-ink">Sin sorpresas</strong> La salida siempre la registrás vos. Las otras residencias no ven a tus residentes.
            </p>
          </div>
        )}
      </header>

      <ul className="divide-y divide-line border-t border-line">
        {ordered.map((item) => {
          const isResolved = item.status === "resolved_new_reservation";
          const badge = responseBadge(item.response);
          return (
            <li key={item.id} className={`flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center ${isResolved ? "bg-cream-2/50" : ""}`}>
              <div className="flex min-w-0 items-center gap-3 lg:w-56 lg:shrink-0">
                <span
                  aria-hidden
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isResolved ? "bg-cream-2 text-ink-faint" : "bg-orange-tint text-orange-700"
                  }`}
                >
                  {item.studentName[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{tidyShortName(item.studentName)}</p>
                  {item.roomTypeName && <p className="truncate text-xs text-ink-faint">{item.roomTypeName}</p>}
                </div>
              </div>

              {isResolved ? (
                <p className="min-w-0 flex-1 text-sm text-ink-soft">
                  Confirmó un nuevo alojamiento ·{" "}
                  <strong className="text-ink">
                    {item.resolvedNewStartDate ? `ingresa allí el ${formatDateOnly(item.resolvedNewStartDate)}` : "ya tiene fecha de ingreso"}
                  </strong>
                </p>
              ) : (
                <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink-faint">Avisó</dt>
                    <dd className="font-semibold text-ink">
                      {formatDateOnly(arDateOf(item.createdAt))}
                      <span className="block text-xs font-normal text-ink-faint">{timeAgoLabel(item.createdAt)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-faint">Salida estimada</dt>
                    <dd className="font-semibold text-ink">
                      {item.estimatedExitDate ? formatDateOnly(item.estimatedExitDate) : "Sin definir"}
                      {item.contractEndDate && (
                        <span className="block text-xs font-normal text-ink-faint">Contrato hasta {formatDateOnly(item.contractEndDate)}</span>
                      )}
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="sr-only">Estado de tu respuesta</dt>
                    <dd>
                      <Badge tone={badge.key === "unanswered" ? "amber" : badge.key === "answered" ? "petrol" : "sage"}>
                        <Icon name={badge.key === "unanswered" ? "schedule" : badge.key === "answered" ? "done" : "done_all"} className="text-sm" />
                        {badge.label}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              )}

              <div className="flex shrink-0 items-center gap-2">
                {isResolved ? (
                  <>
                    <Badge tone="neutral">Aviso cerrado</Badge>
                    <Button type="button" size="sm" variant="outline" onClick={() => onRegisterExit(item)}>
                      Registrar salida
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant={item.response ? "outline" : "primary"} onClick={() => onRespond(item)}>
                    {item.response ? "Editar respuesta" : "Responder"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {planning && (
        <footer className="flex flex-col gap-2 border-t border-line bg-cream-2/60 px-5 py-3 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-start gap-2">
            <Icon name="event_available" className="mt-0.5 shrink-0 text-base text-forest-700" />
            <span>{planning}</span>
          </p>
          <Link href={`/residence/${residenceId}/availability`} className="shrink-0 font-bold text-forest-700 underline underline-offset-2">
            Revisar disponibilidad
          </Link>
        </footer>
      )}
    </section>
  );
}
