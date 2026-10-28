"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { StatusTag, availabilityLabel } from "@/components/ui/StatusTag";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import { isTypePaused, isTypeRequestable, typeAvailabilityMode } from "@/lib/availability/typeAvailability";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import type { ReservationWindowNotice } from "@/lib/students/reservationWindow";
import type { RequestPanelMode } from "@/lib/residences/requestPanelMode";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/** Texto de "Para reservar" ya resuelto en el servidor ("Primer mes" o "USD 400"), más los datos clave de la card. */
export type PanelKeyFacts = {
  initialPaymentLabel: string;
  /** El pago inicial es "primer mes": con un tipo elegido se agrega su monto ("Primer mes · USD 220"). */
  initialIsFirstMonth: boolean;
  depositLabel: string | null;
  minimumStayLabel: string | null;
};

/**
 * Card de precio y condiciones (SPEC §4.2): el panel lateral deja de ser un formulario con scroll interno (D20) y
 * pasa a ser una card corta con precio, tipo elegido y el CTA según el rol. El formulario vive en la hoja
 * (`RequestSheet`). Para invitados también muestra precios (D17/H10). En mobile es la "card de solicitud" de la
 * sección Tarifas: sin selector (ya está en las tarjetas de arriba).
 */
export function RequestPanel({
  slug,
  mode,
  roomTypes,
  fromPriceUsd,
  fromArsRounded,
  keyFacts,
  studentName,
  slot,
  windowNotice,
  waitlistTypeIds,
}: {
  slug: string;
  mode: RequestPanelMode;
  roomTypes: FichaRoomType[];
  fromPriceUsd: number | null;
  fromArsRounded: number | null;
  keyFacts: PanelKeyFacts;
  /** Nombre del estudiante al que propone el familiar (si es uno solo). */
  studentName: string | null;
  /** Contenido del servidor para los modos sin acción interactiva (aviso de menor, vista previa del equipo, etc.). */
  slot: ReactNode;
  /** Reserva vigente del estudiante: solo puede pedir fechas posteriores (el CTA sigue habilitado). */
  windowNotice: ReservationWindowNotice | null;
  /** Tipos completos en los que puede sumarse a la lista de espera (excluye el tipo de su reserva en esta residencia). */
  waitlistTypeIds: string[];
}) {
  const { roomTypeId, setRoomTypeId, openSheet } = useReservationSelection();

  const requestable = roomTypes.filter((rt) => isTypeRequestable(rt.state));
  const selected = requestable.find((rt) => rt.id === roomTypeId) ?? null;
  const hasPrices = roomTypes.length > 0 && fromPriceUsd != null;
  const allFull = roomTypes.length > 0 && roomTypes.every((rt) => rt.state === "full");
  const allPaused = roomTypes.length > 0 && roomTypes.every((rt) => isTypePaused(rt.state));
  const noneRequestable = requestable.length === 0;
  const showNotUpdatedNotice = selected
    ? selected.state === "not_updated"
    : requestable.length > 0 && requestable.every((rt) => rt.state === "not_updated");

  const loginHref = `/login?next=${encodeURIComponent(
    `/residencias/${slug}?${selected ? `room=${selected.id}&` : ""}solicitar=1`,
  )}`;

  const priceUsd = selected?.priceUsd ?? fromPriceUsd;
  const priceArs = selected?.arsRounded ?? fromArsRounded;
  const isTeam = mode === "team";

  return (
    <Card className="p-5 sm:p-6">
      {!isTeam && (
        <>
          {hasPrices ? (
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-muted">
                {selected ? selected.name : "Desde"}
              </p>
              <p className="mt-1 font-display text-4xl font-extrabold leading-none text-ink">
                {priceUsd != null ? formatUsd(priceUsd) : ""}
                <span className="text-base font-semibold text-ink-faint"> /mes</span>
              </p>
              {priceArs != null && (
                <p className="mt-1.5 text-xs text-ink-faint">
                  ≈ {formatArs(priceArs)} por mes, referencial
                  <ExchangeRateNote />
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="font-display text-xl font-extrabold text-ink">Todavía sin tarifas publicadas</p>
              <p className="mt-1 text-sm text-ink-soft">
                La residencia todavía no publicó sus tarifas.{" "}
                <a href="#preguntas" className="font-bold text-forest-700 hover:underline">
                  Hacer una pregunta
                </a>
              </p>
            </div>
          )}

          {allFull && (
            <div className="mt-4 space-y-1.5">
              <StatusTag mode="full" withTip />
              <p className="text-xs leading-relaxed text-ink-soft">
                Sumarte a la lista de espera no es una solicitud ni reserva un lugar.
              </p>
            </div>
          )}
          {allPaused && (
            <p className="mt-4 rounded-field bg-sand-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
              Las solicitudes de esta residencia están pausadas por ahora. Volvé a mirar más adelante o explorá otras
              residencias.
            </p>
          )}
          {showNotUpdatedNotice && (
            <p className="mt-4 rounded-field bg-sand-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
              La residencia no actualizó su disponibilidad. Podés enviar la solicitud igual: te confirma si hay lugar.
            </p>
          )}

          {roomTypes.length > 0 && (
            <fieldset className="mt-5 hidden min-w-0 lg:block">
              <legend className="mb-2 text-sm font-bold text-ink">Elegí tu tipo de habitación</legend>
              <div className="space-y-1.5">
                {roomTypes.map((rt) => {
                  const canPick = isTypeRequestable(rt.state);
                  const isSelected = selected?.id === rt.id;
                  const stateText = availabilityLabel(typeAvailabilityMode(rt.state), rt.state === "full" ? rt.name : null);
                  return (
                    <label
                      key={rt.id}
                      className={`flex items-center gap-3 rounded-field border-[1.5px] px-3 py-2.5 transition-colors duration-200 ease-fresh ${
                        isSelected
                          ? "border-forest bg-forest-tint/55"
                          : canPick
                            ? "cursor-pointer border-line hover:border-forest"
                            : "border-line bg-cream-2/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipo-panel"
                        value={rt.id}
                        checked={isSelected}
                        disabled={!canPick}
                        onChange={() => setRoomTypeId(rt.id)}
                        aria-label={`${rt.name}, ${formatUsd(rt.priceUsd)} por mes, ${stateText}`}
                        className="h-4 w-4 shrink-0 accent-[var(--color-forest)] disabled:cursor-not-allowed"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-bold ${canPick ? "text-ink" : "text-ink-soft"}`}>{rt.name}</span>
                        <span
                          className={`block text-[11px] font-semibold ${
                            rt.state === "available"
                              ? "text-info-fg"
                              : rt.state === "full" || rt.state === "paused_by_admin"
                                ? "text-warning-fg"
                                : "text-ink-faint"
                          }`}
                        >
                          {stateText}
                        </span>
                      </span>
                      <span className={`text-sm font-extrabold ${canPick ? "text-ink" : "text-ink-soft"}`}>
                        {rt.listPriceUsd != null && (
                          <span className="mr-1 text-xs font-semibold text-ink-faint line-through">
                            <span className="sr-only">Antes </span>
                            {formatUsd(rt.listPriceUsd)}
                          </span>
                        )}
                        {formatUsd(rt.priceUsd)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Datos clave: se ocultan en pantallas bajas para que el CTA nunca quede fuera de la vista (D20). */}
          <dl className="mt-5 hidden space-y-1.5 border-t border-line pt-4 text-sm lg:block [@media(max-height:820px)]:hidden!">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Para reservar</dt>
              <dd className="text-right font-bold text-ink">
                {keyFacts.initialIsFirstMonth && selected
                  ? `${keyFacts.initialPaymentLabel} · ${formatUsd(selected.priceUsd)}`
                  : keyFacts.initialPaymentLabel}
              </dd>
            </div>
            {keyFacts.depositLabel && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Depósito</dt>
                <dd className="text-right font-bold text-ink">{keyFacts.depositLabel}</dd>
              </div>
            )}
            {keyFacts.minimumStayLabel && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Estadía mínima</dt>
                <dd className="text-right font-bold text-ink">{keyFacts.minimumStayLabel}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {/* CTA según el rol (SPEC §5). */}
      <div className={isTeam ? "" : "mt-5"}>
        {mode === "guest" && (
          <>
            {noneRequestable ? (
              allPaused ? null : (
                <Button href={loginHref} size="lg" className="w-full">
                  Ingresá para sumarte a la lista de espera
                </Button>
              )
            ) : (
              <Button href={loginHref} size="lg" className="w-full">
                Ingresá para solicitar
              </Button>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              Te pedimos que ingreses con tu cuenta de estudiante: volvés acá con tu elección guardada.{" "}
              <Link href="/register/student" className="font-bold text-forest-700 hover:underline">
                Crear cuenta de estudiante
              </Link>
            </p>
          </>
        )}

        {mode === "student" && windowNotice && windowNotice.stayChangeOpen && (
          <div className="mb-3 rounded-field border border-orange/30 bg-warning-bg px-3.5 py-3 text-xs leading-relaxed text-warning-fg">
            <p className="flex items-start gap-2">
              <Icon name="swap_horiz" className="mt-0.5 shrink-0 text-base" />
              <span>
                <strong>Estás buscando cambiar de residencia;</strong> tu residencia actual fue avisada. Podés solicitar para cualquier fecha, aunque se
                superponga con tu estadía.
              </span>
            </p>
            <Link href="/students/residency#quiero-cambiar" className="mt-1.5 inline-block font-bold underline underline-offset-2">
              Ir a Mi residencia
            </Link>
          </div>
        )}

        {mode === "student" && windowNotice && !windowNotice.stayChangeOpen && (
          <div className="mb-3 space-y-2">
            <p className="flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-fg">
              <Icon name="event_available" className="mt-0.5 shrink-0 text-base" />
              <span>
                {windowNotice.message}{" "}
                <Link href="/students/residency" className="font-bold underline underline-offset-2">
                  Ir a Mi residencia
                </Link>
              </span>
            </p>
            <p className="flex items-center gap-1.5 px-1 text-xs text-ink-soft">
              <Icon name="swap_horiz" className="text-base text-orange-700" />
              ¿Querés mudarte antes?{" "}
              <Link href="/students/residency#quiero-cambiar" className="font-bold text-forest-700 hover:underline">
                Quiero cambiar de residencia
              </Link>
            </p>
          </div>
        )}

        {mode === "student" &&
          (noneRequestable ? (
            allPaused || waitlistTypeIds.length === 0 ? null : (
              <Button type="button" size="lg" className="w-full" onClick={() => openSheet("waitlist")}>
                Sumarme a la lista de espera
              </Button>
            )
          ) : selected ? (
            <Button type="button" size="lg" className="w-full" onClick={() => openSheet("request")}>
              Solicitar lugar en {selected.name}
            </Button>
          ) : (
            <Button type="button" size="lg" className="w-full" disabled>
              Elegí un tipo para solicitar
            </Button>
          ))}

        {mode === "family" &&
          (noneRequestable ? (
            <p className="text-sm text-ink-soft">No hay lugares disponibles en este momento.</p>
          ) : (
            <>
              <div className="mb-3 empty:hidden">{slot}</div>
              <Button type="button" size="lg" className="w-full" onClick={() => openSheet("request")}>
                {studentName ? `Proponer a ${studentName}` : "Proponer esta residencia"}
              </Button>
            </>
          ))}

        {mode !== "guest" && mode !== "student" && mode !== "family" && slot}
      </div>

      {(mode === "guest" || mode === "student") && !noneRequestable && (
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Enviar la solicitud es gratis. La residencia la revisa y responde en hasta 48 horas. Toda reserva está sujeta
          a confirmación.
        </p>
      )}
      {mode === "family" && (
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Una propuesta no es una solicitud: {studentName ?? "tu estudiante"} la ve en su panel y decide si la envía.
        </p>
      )}

      {!isTeam && (
        <p className="mt-4 hidden border-t border-line pt-3 text-sm text-ink-soft lg:block [@media(max-height:820px)]:hidden!">
          ¿Tenés dudas?{" "}
          <a href="#preguntas" className="font-bold text-forest-700 hover:underline">
            Preguntale a la residencia →
          </a>
        </p>
      )}
    </Card>
  );
}
