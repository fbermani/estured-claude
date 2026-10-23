"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { InfoTip } from "@/components/ui/InfoTip";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import { buildInitialPayment, type InitialPaymentConfig } from "@/lib/reservations/initialPayment";
import { emptyMonthsChargeUsd, MAX_EMPTY_MONTHS } from "@/lib/applications/emptyMonths";
import {
  createApplicationRequest,
  type CreateApplicationState,
} from "@/app/students/applications/actions";
import { JoinWaitlistForm } from "@/app/(public)/residencias/[slug]/JoinWaitlistForm";
import { useReservationSelection } from "@/components/residences/reservationSelection";
import { isTypePaused, isTypeRequestable, typeAvailabilityState } from "@/lib/availability/typeAvailability";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  profile_availability: { status: string } | null;
}

/** Condiciones de reserva a nivel residencia (migración 0025). */
interface ResidenceConditionsProp {
  minimumStayMonths: number | null;
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentFeeFrequency: "once" | "annual";
  depositUsd: number | null;
  emptyMonthChargePercent: number | null;
  /** Pago inicial para reservar a la residencia (D7/H08): primer mes o monto fijo. */
  initialPayment: InitialPaymentConfig;
}

const initialState: CreateApplicationState = { status: "idle" };

const ACADEMIC_OBJECTIVE_OPTIONS = [
  "Empezar mi carrera",
  "Continuar mis estudios",
  "Intercambio académico",
  "Posgrado o especialización",
];

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Salida = entrada + N meses − 1 día (ref: 1 Mar + 6 meses → 31 Ago). */
function computeExitDate(entrada: string, months: number): string {
  const [y, m, d] = entrada.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return formatDateOnly(end.toISOString().slice(0, 10));
}

/** Nombres de los primeros meses vacíos, para la etiqueta "Mes vacío (agosto…)". */
function emptyMonthNames(count: number): string[] {
  const now = new Date();
  const names: string[] = [];
  for (let i = 1; i <= count && names.length < 2; i++) {
    names.push(MONTH_NAMES[(now.getMonth() + i) % 12]);
  }
  return names;
}

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
}: {
  residenceId: string;
  roomTypes: RoomTypeOption[];
  conditions: ResidenceConditionsProp;
  arsPerUsd: number;
  /** Ciclo 35: nudge no bloqueante hacia /students/profile. `null` si ya está 100% completo. */
  profileCompletenessPercent?: number | null;
  /** Reserva vigente (Ciclo 58): primera fecha de ingreso permitida ("YYYY-MM-DD"). Validación de UI; el servidor igual valida. */
  minStartDate?: string | null;
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
  const monthlyUsd = selected ? Number(selected.monthly_price_usd) : 0;
  const enrollmentUsd =
    conditions.enrollmentFeeMode === "one_month"
      ? monthlyUsd
      : conditions.enrollmentFeeMode === "manual"
        ? (conditions.enrollmentFeeUsd ?? 0)
        : 0;
  const depositUsd = conditions.depositUsd ?? 0;
  const emptyPercent = conditions.emptyMonthChargePercent;

  const empty = startDate
    ? emptyMonthsChargeUsd({ desiredStartDate: startDate, monthlyPriceUsd: monthlyUsd, chargePercent: emptyPercent })
    : { months: 0, chargeUsd: 0 };
  const emptyNames = emptyMonthNames(empty.months);
  const emptyChargeUsd = empty.chargeUsd;
  const rentTotalUsd = monthlyUsd * duration;
  const reservationTotalUsd = rentTotalUsd + enrollmentUsd + emptyChargeUsd;
  const fee =
    selected && duration > 0
      ? calculateFeeEstimate({
          monthlyPriceUsd: monthlyUsd,
          durationMonths: duration,
          enrollmentFeeUsd: enrollmentUsd,
          emptyMonthsChargeUsd: emptyChargeUsd,
          arsPerUsd,
        })
      : null;
  const feeUsd = fee ? reservationTotalUsd * 0.05 : 0;
  const initialPayment = buildInitialPayment(conditions.initialPayment, monthlyUsd, arsPerUsd);

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
        hint={minStartDate ? `Podés pedir desde el ${formatDateOnly(minStartDate)}, cuando termina tu reserva actual.` : undefined}
      />
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
        <div className="rounded-field border border-line bg-cream-2 p-4 text-sm">
          {/* Entrada → salida, como la referencia */}
          {startDate && (
            <div className="mb-3 flex items-center justify-between rounded-field border border-line bg-paper px-3 py-2.5">
              <span>
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-muted">Entrada</span>
                <span className="font-bold text-ink">{formatDateOnly(startDate)}</span>
              </span>
              <Icon name="arrow_forward" className="text-lg text-ink-faint" />
              <span className="text-right">
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-muted">Salida</span>
                <span className="font-bold text-ink">{computeExitDate(startDate, duration)}</span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-1.5">
            <span className="text-ink-soft">
              Renta mensual (×{duration})
              <InfoTip label="Cómo se calcula la renta">
                {formatUsd(monthlyUsd)} por mes durante {duration} {duration === 1 ? "mes" : "meses"} de estadía.
                Se paga mes a mes directamente a la residencia.
              </InfoTip>
            </span>
            <span className="font-bold text-ink">{formatUsd(rentTotalUsd)}</span>
          </div>
          <p className="-mt-1 pb-1.5 text-xs text-ink-faint">
            ≈ {formatArs(usdToArsRounded(monthlyUsd, arsPerUsd))} por mes, referencial
            <ExchangeRateNote />
          </p>

          {enrollmentUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-ink-soft">
                Matrícula {conditions.enrollmentFeeFrequency === "annual" ? "(anual)" : "(única vez)"}
                <InfoTip label="Qué es la matrícula">
                  Cargo administrativo de ingreso que define la residencia
                  {conditions.enrollmentFeeMode === "one_month" ? ", equivalente a 1 mes de renta" : ""}. No es
                  reembolsable y forma parte de la base del fee de EstuRed.
                  {conditions.enrollmentFeeFrequency === "annual" && " Se renueva cada año de estadía."}
                </InfoTip>
              </span>
              <span className="font-bold text-ink">{formatUsd(enrollmentUsd)}</span>
            </div>
          )}

          {emptyChargeUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-orange-700">
                Mes vacío {emptyNames.length > 0 && `(${emptyNames.join(" y ")}${empty.months > 2 ? "…" : ""})`}
                <InfoTip label="Qué es el mes vacío">
                  La residencia reserva tu lugar durante {empty.months === 1 ? "el mes completo" : `los ${empty.months} meses completos`}{" "}
                  entre hoy y tu ingreso (máximo {MAX_EMPTY_MONTHS}), al {emptyPercent}% de la renta mensual. Lo
                  define cada residencia en su configuración.
                </InfoTip>
              </span>
              <span className="font-bold text-orange-700">{formatUsd(emptyChargeUsd)}</span>
            </div>
          )}

          {depositUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-ink-soft">
                Depósito
                <InfoTip label="Qué es el depósito">
                  Garantía reembolsable que se devuelve al egreso si no hay daños. Se paga directamente a la
                  residencia y NO forma parte de la base del fee de EstuRed.
                </InfoTip>
              </span>
              <span className="text-right font-bold text-ink">
                {formatUsd(depositUsd)}
                <span className="block text-[10px] font-normal text-ink-faint">reembolsable</span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between border-t-[1.5px] border-line-2 py-2">
            <span className="font-bold text-ink">
              Total de la reserva
              <InfoTip label="Qué incluye el total">
                Renta × meses + matrícula{emptyChargeUsd > 0 ? " + mes vacío" : ""}. No incluye el depósito
                (reembolsable). Es el monto sobre el que se calcula el fee de EstuRed.
              </InfoTip>
            </span>
            <span className="font-extrabold text-ink">{formatUsd(reservationTotalUsd)}</span>
          </div>

          {/* D7/H08: qué se paga a la residencia para reservar (pago inicial) — distinto del fee y del total de la estadía. */}
          <div className="mt-1 rounded-field border border-line bg-paper px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-ink">
                A la residencia
                <InfoTip label="Qué es el pago inicial">
                  {initialPayment.mode === "custom_usd"
                    ? "Monto fijo que define la residencia para reservar."
                    : "La residencia pide el primer mes de renta para reservar."}{" "}
                  Se paga directamente a la residencia, no a EstuRed, antes de la fecha límite: aparece en tu solicitud
                  cuando la residencia habilita el pago.
                </InfoTip>
                <span className="block text-[11px] font-normal text-ink-faint">
                  Pago inicial para reservar
                  {initialPayment.mode === "one_month" ? " (primer mes)" : ""}
                </span>
              </span>
              <span className="text-right font-extrabold text-ink">
                {formatUsd(initialPayment.usd)}
                <span className="block text-[10px] font-normal text-ink-faint">
                  ≈ {formatArs(initialPayment.arsDisplay)}
                  <ExchangeRateNote />
                </span>
              </span>
            </div>
          </div>

          {fee && (
            <div className="mt-2 rounded-field border border-orange/40 bg-warning-bg px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-warning-fg">
                  A EstuRed: fee (5%)
                  <InfoTip label="Cómo funciona el fee">
                    Único cobro de EstuRed: 5% del total de la reserva. Se abona únicamente si la residencia
                    confirma tu reserva — enviar la solicitud no cuesta nada.
                  </InfoTip>
                </span>
                <span className="text-right font-extrabold text-warning-fg">
                  {formatUsd(feeUsd)}
                  <span className="block text-[10px] font-normal">
                    ≈ {formatArs(fee.estimatedFeeArs)}
                    <ExchangeRateNote />
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-warning-fg/90">
                Se abona solo al confirmarse la reserva. Enviar la solicitud es gratis.
              </p>
            </div>
          )}
        </div>
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
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft">
          <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--color-forest)]" />
          Leí y acepto las condiciones y el reglamento de convivencia de la residencia.
        </label>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Enviando…" : "Enviar solicitud de reserva"}
        </Button>
        <p className="text-center text-xs text-ink-faint">
          La residencia verá tu carrera y universidad y tiene 48 horas para responder; si no lo hace, la solicitud
          vence.
        </p>
      </div>
    </form>
  );
}
