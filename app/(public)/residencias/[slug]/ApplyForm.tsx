"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { formatUsd } from "@/lib/mock/exchange";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import type { VacancyOutlook } from "@/lib/applications/emptyMonths";
import { CostBreakdown, type CostBreakdownConditions } from "@/components/residences/ficha/CostBreakdown";
import {
  createApplicationRequest,
  type CreateApplicationState,
} from "@/app/students/applications/actions";
import { JoinWaitlistForm } from "@/app/(public)/residencias/[slug]/JoinWaitlistForm";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import { isTypePaused, isTypeRequestable, typeAvailabilityState } from "@/lib/availability/typeAvailability";
import { MAX_MOVING_NOTE, MOVING_NOTE_HELP, MOVING_NOTE_LABEL } from "@/lib/stayChange/copy";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  /** Promoción vigente (DR18 t3): % sobre la tarifa de lista; el servidor la vuelve a resolver al enviar. */
  promotion_percent?: number | null;
  /** Ocupación futura del tipo (la arma el servidor); null/ausente = «a confirmar». */
  vacancy?: VacancyOutlook | null;
  profile_availability: { status: string } | null;
}

/** Condiciones de reserva a nivel residencia (migración 0025). */
interface ResidenceConditionsProp extends CostBreakdownConditions {
  minimumStayMonths: number | null;
}

const initialState: CreateApplicationState = { status: "idle" };

const ACADEMIC_OBJECTIVE_OPTIONS = [
  "Empezar mi carrera",
  "Continuar mis estudios",
  "Intercambio académico",
  "Posgrado o especialización",
];

/**
 * Formulario de solicitud con previa completa de la reserva — a
 * semejanza del panel "Tu Solicitud de Reserva" de la referencia
 * `estured_search_results_buenos_aires_3`: entrada→salida, renta ×N,
 * matrícula, mes vacío, total, fee 5% destacado y aceptación de
 * condiciones — cada cargo con tooltip explicativo (InfoTip).
 * Diferencia deliberada con la referencia: el bloque destacado NO dice
 * "total a pagar ahora" — enviar la solicitud no cuesta nada y el fee
 * se abona recién si la residencia confirma (docs/00 §12).
 */
export function ApplyForm({
  residenceId,
  roomTypes,
  conditions,
  arsPerUsd,
  profileCompletenessPercent,
  minStartDate,
  stayChange,
  regulation,
}: {
  residenceId: string;
  /** Reglamento vigente (DR14) ya renderizado en el servidor + su hash; `null` si no se pudo leer (no se puede enviar). */
  regulation: { hash: string; content: ReactNode; isModel: boolean } | null;
  roomTypes: RoomTypeOption[];
  conditions: ResidenceConditionsProp;
  arsPerUsd: number;
  /** Ciclo 35: nudge no bloqueante hacia /students/profile. `null` si ya está 100% completo. */
  profileCompletenessPercent?: number | null;
  /** Reserva vigente (Ciclo 58): primera fecha de ingreso permitida ("YYYY-MM-DD"). Validación de UI; el servidor igual valida. */
  minStartDate?: string | null;
  /** Aviso "Quiero cambiar" abierto (DR3): la solicitud puede superponerse con su estadía. `currentEndDate` es el fin de contrato exclusivo ("YYYY-MM-DD"). */
  stayChange?: { currentEndDate: string; currentEndLabel: string } | null;
}) {
  const action = createApplicationRequest.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const availableTypes = roomTypes.filter((rt) => isTypeRequestable(typeAvailabilityState(rt.profile_availability?.status)));
  // Tipo de habitación seedeada desde `?room=` en la primera carga por
  // ReservationSelectionProvider (page.tsx) y luego controlada por el
  // contexto compartido con CommunityBrowser — elegir una plaza libre
  // ahí completa este campo en tiempo real, sin recargar la página
  // (Ciclo 35octodevicies).
  const { roomTypeId: contextRoomTypeId, setRoomTypeId } = useReservationSelection();
  const roomTypeId = availableTypes.some((rt) => rt.id === contextRoomTypeId) ? (contextRoomTypeId as string) : "";
  const [duration, setDuration] = useState(6);
  const [startDate, setStartDate] = useState("");
  const [objectiveChoice, setObjectiveChoice] = useState("");
  const [movingNote, setMovingNote] = useState("");
  const regulationRef = useRef<HTMLDetailsElement>(null);

  if (roomTypes.length === 0) {
    return <p className="px-5 py-5 text-sm text-ink-soft sm:px-6">Esta residencia todavía no cargó tipos de habitación.</p>;
  }
  if (availableTypes.length === 0) {
    // Todos los tipos pausados (por la residencia o por EstuRed): no es "completa", así que no se ofrece lista de espera.
    if (roomTypes.every((rt) => isTypePaused(typeAvailabilityState(rt.profile_availability?.status)))) {
      return (
        <p className="px-5 py-5 text-sm text-ink-soft sm:px-6">
          Las solicitudes de esta residencia están pausadas por ahora. Volvé a mirar más adelante o explorá otras
          residencias.
        </p>
      );
    }
    return <JoinWaitlistForm residenceId={residenceId} roomTypes={roomTypes} minStartDate={minStartDate} />;
  }

  const selected = availableTypes.find((rt) => rt.id === roomTypeId) ?? null;
  const overlapsStay = !!stayChange && !!startDate && startDate < stayChange.currentEndDate;
  const monthlyUsd = selected ? Number(selected.monthly_price_usd) : 0;

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      {/* Cuerpo con scroll propio; el pie (aceptación + enviar) queda fijo y siempre visible (D20). */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted">1 · Tu estadía</p>
      <Select
        label="Tipo de habitación"
        id="apply-room-type"
        name="room_type_id"
        required
        value={roomTypeId}
        onChange={(e) => setRoomTypeId(e.target.value)}
      >
        <option value="" disabled>
          Elegí una opción
        </option>
        {availableTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.name} — {formatUsd(Number(rt.monthly_price_usd))}/mes
          </option>
        ))}
      </Select>
      <Input
        label="Fecha de ingreso deseada"
        id="apply-start-date"
        name="desired_start_date"
        type="date"
        required
        min={minStartDate ?? undefined}
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        aria-describedby={overlapsStay ? "apply-overlap-notice" : undefined}
        hint={minStartDate ? `Podés pedir desde el ${formatDateOnly(minStartDate)}, cuando termina tu reserva actual.` : undefined}
      />
      {overlapsStay && stayChange && (
        <p
          id="apply-overlap-notice"
          className="-mt-2 flex items-start gap-2 rounded-field bg-warning-bg px-3.5 py-2.5 text-xs leading-relaxed text-warning-fg"
        >
          <Icon name="swap_horiz" className="mt-0.5 shrink-0 text-base" />
          <span>
            Esta fecha se superpone con tu estadía actual (hasta el {stayChange.currentEndLabel}). Podés enviarla porque tenés abierto tu aviso de cambio. Si se
            confirma, coordiná tu salida con tu residencia:{" "}
            <a href="/students/residency#respuesta-residencia" className="font-bold underline underline-offset-2">
              ver lo que te informó
            </a>
            .
          </span>
        </p>
      )}
      <Input
        label="Duración estimada (meses)"
        id="apply-duration"
        name="initial_duration_months"
        type="number"
        min={conditions.minimumStayMonths ?? 1}
        max={24}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value) || 0)}
        required
        hint={
          conditions.minimumStayMonths
            ? `Esta residencia pide una estadía mínima de ${conditions.minimumStayMonths} meses.`
            : undefined
        }
      />

      {selected && duration > 0 && (
        <CostBreakdown
          monthlyUsd={monthlyUsd}
          promotionPercent={selected.promotion_percent ?? null}
          vacancy={selected.vacancy ?? null}
          duration={duration}
          startDate={startDate}
          conditions={conditions}
          arsPerUsd={arsPerUsd}
        />
      )}

      <p className="mt-1 text-xs font-extrabold uppercase tracking-widest text-muted">2 · Sobre vos</p>
      <div>
        <span id="apply-objective-label" className="mb-1.5 block text-sm font-semibold text-ink">¿Cuál es tu objetivo académico?</span>
        <input type="hidden" name="academic_objective_choice" value={objectiveChoice} />
        <div role="group" aria-labelledby="apply-objective-label" className="flex flex-wrap gap-2">
          {ACADEMIC_OBJECTIVE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setObjectiveChoice(option)}
              aria-pressed={objectiveChoice === option}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                objectiveChoice === option
                  ? "border-forest bg-forest-tint text-forest-700"
                  : "border-line-2 bg-paper text-ink-soft hover:border-forest"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <Textarea
          id="apply-objective-detail"
          name="academic_objective_detail"
          rows={2}
          aria-label="Más detalle sobre tu objetivo académico (opcional)"
          placeholder="Agregá más detalle si querés (opcional)."
          hint="Se usa para tu comprobante de reserva."
          className="mt-2.5"
        />
      </div>

      {stayChange && (
        <div className="rounded-field border border-line-2 bg-cream-2/50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted">3 · Tu mudanza (opcional)</p>
          <Textarea
            id="apply-move-note"
            name="move_context_note"
            rows={3}
            maxLength={MAX_MOVING_NOTE}
            label={MOVING_NOTE_LABEL}
            hint={MOVING_NOTE_HELP}
            className="mt-2"
            value={movingNote}
            onChange={(e) => setMovingNote(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-ink-faint">
            {movingNote.length}/{MAX_MOVING_NOTE}
          </p>
          <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
            <Icon name="visibility_off" className="mt-0.5 shrink-0 text-base" />
            Esta residencia ve que estás en proceso de mudanza, pero no desde qué residencia. Solo ve lo que escribas arriba.
          </p>
        </div>
      )}

      <div>
        <p className="mt-1 text-xs font-extrabold uppercase tracking-widest text-muted">{stayChange ? "4" : "3"} · Reglamento</p>
        {regulation ? (
          <details ref={regulationRef} id="apply-regulation" className="mt-2 rounded-field border border-line-2 bg-cream-2/50 p-4">
            <summary className="cursor-pointer text-sm font-bold text-forest-700">Leer el reglamento completo de la residencia</summary>
            {regulation.isModel && (
              <p className="mt-2 text-xs text-ink-faint">
                La residencia todavía no cargó el suyo: este es el modelo de convivencia de EstuRed.
              </p>
            )}
            <div className="mt-3">{regulation.content}</div>
          </details>
        ) : (
          <p role="alert" className="mt-2 rounded-field bg-warning-bg px-3.5 py-2.5 text-xs leading-relaxed text-warning-fg">
            No pudimos cargar el reglamento de la residencia. Recargá la página para poder enviar la solicitud.
          </p>
        )}
      </div>

      {profileCompletenessPercent != null && profileCompletenessPercent < 100 && (
        <a
          href="/students/profile"
          className="flex items-center justify-between gap-3 rounded-field border border-line-2 bg-cream-2 px-3.5 py-2.5 text-xs text-ink-soft hover:border-forest"
        >
          <span>
            Tu perfil está {profileCompletenessPercent}% completo. Completarlo ayuda a que la residencia te conozca.
          </span>
          <Icon name="chevron_right" className="shrink-0 text-base" />
        </a>
      )}

      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line bg-paper px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-6px_16px_rgb(29_39_34/0.05)] sm:px-6">
        {state.status === "error" && (
          <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}
        {regulation && <input type="hidden" name="regulation_hash" value={regulation.hash} />}
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="accept_regulation"
            required
            disabled={!regulation}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--color-forest)]"
          />
          <span>
            Leí y acepto el reglamento de la residencia.{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (regulationRef.current) {
                  regulationRef.current.open = true;
                  regulationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              className="font-bold text-forest-700 underline underline-offset-2"
            >
              Leerlo completo
            </button>
          </span>
        </label>
        <Button type="submit" size="lg" disabled={isPending || !regulation}>
          {isPending ? "Enviando…" : "Enviar solicitud de reserva"}
        </Button>
        <p className="text-center text-xs text-ink-faint">
          La residencia verá tu carrera y universidad y tiene 48 horas para responder; si no lo hace, la solicitud
          vence. Solicitud sujeta a confirmación: enviarla no te asegura el lugar.
        </p>
      </div>
    </form>
  );
}
