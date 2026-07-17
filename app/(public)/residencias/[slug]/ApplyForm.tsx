"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { InfoTip } from "@/components/ui/InfoTip";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";
import { calculateFeeEstimate } from "@/lib/applications/fee";
import {
  createApplicationRequest,
  type CreateApplicationState,
} from "@/app/students/applications/actions";
import { JoinWaitlistForm } from "@/app/(public)/residencias/[slug]/JoinWaitlistForm";

interface RoomTypeOption {
  id: string;
  name: string;
  monthly_price_usd: number;
  enrollment_fee_usd?: number | null;
  deposit_usd?: number | null;
  empty_month_charge_percent?: number | null;
  profile_availability: { status: string } | null;
}

const initialState: CreateApplicationState = { status: "idle" };

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDateOnly(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]?.slice(0, 3) ?? ""} ${y}`;
}

/** Salida = entrada + N meses − 1 día (ref: 1 Mar + 6 meses → 31 Ago). */
function computeExitDate(entrada: string, months: number): string {
  const [y, m, d] = entrada.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return `${end.getUTCDate()} ${MONTH_NAMES[end.getUTCMonth()].slice(0, 3)} ${end.getUTCFullYear()}`;
}

/**
 * Meses vacíos = meses calendario COMPLETOS entre hoy y la entrada
 * (supuesto reversible documentado en la migración 0024): la residencia
 * reserva el lugar durante esos meses y cobra un % de la renta.
 */
function computeEmptyMonths(entrada: string): { count: number; names: string[] } {
  const [y, m] = entrada.split("-").map(Number);
  const now = new Date();
  const count = Math.max(0, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()) - 1);
  const names: string[] = [];
  for (let i = 1; i <= count && names.length < 2; i++) {
    names.push(MONTH_NAMES[(now.getMonth() + i) % 12]);
  }
  return { count, names };
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
  arsPerUsd,
  preselectedRoomTypeId,
}: {
  residenceId: string;
  roomTypes: RoomTypeOption[];
  arsPerUsd: number;
  preselectedRoomTypeId?: string;
}) {
  const action = createApplicationRequest.bind(null, residenceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const availableTypes = roomTypes.filter((rt) => rt.profile_availability?.status !== "full");
  const validPreselected = availableTypes.some((rt) => rt.id === preselectedRoomTypeId)
    ? (preselectedRoomTypeId as string)
    : "";
  const [roomTypeId, setRoomTypeId] = useState(validPreselected);
  const [duration, setDuration] = useState(6);
  const [startDate, setStartDate] = useState("");

  if (roomTypes.length === 0) {
    return <p className="text-sm text-ink-soft">Esta residencia todavía no cargó tipos de habitación.</p>;
  }
  if (availableTypes.length === 0) {
    return <JoinWaitlistForm residenceId={residenceId} roomTypes={roomTypes} />;
  }

  const selected = availableTypes.find((rt) => rt.id === roomTypeId) ?? null;
  const monthlyUsd = selected ? Number(selected.monthly_price_usd) : 0;
  const enrollmentUsd = selected?.enrollment_fee_usd != null ? Number(selected.enrollment_fee_usd) : 0;
  const depositUsd = selected?.deposit_usd != null ? Number(selected.deposit_usd) : 0;
  const emptyPercent = selected?.empty_month_charge_percent != null ? Number(selected.empty_month_charge_percent) : null;

  const empty = startDate ? computeEmptyMonths(startDate) : { count: 0, names: [] };
  const emptyChargeUsd = emptyPercent != null && empty.count > 0 ? empty.count * monthlyUsd * (emptyPercent / 100) : 0;
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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h3 className="font-bold text-ink">Tu solicitud de reserva</h3>
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
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <Input
        label="Duración estimada (meses)"
        id="apply-duration"
        name="initial_duration_months"
        type="number"
        min={1}
        max={24}
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value) || 0)}
        required
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
                Se paga mes a mes directamente a la residencia. ≈ {formatArs(usdToArs(monthlyUsd, arsPerUsd))} por
                mes al valor referencial de hoy.
              </InfoTip>
            </span>
            <span className="font-bold text-ink">{formatUsd(rentTotalUsd)}</span>
          </div>

          {enrollmentUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-ink-soft">
                Matrícula
                <InfoTip label="Qué es la matrícula">
                  Cargo de ingreso por única vez que define la residencia. No es reembolsable y forma parte de la
                  base del fee de EstuRed.
                </InfoTip>
              </span>
              <span className="font-bold text-ink">{formatUsd(enrollmentUsd)}</span>
            </div>
          )}

          {emptyChargeUsd > 0 && (
            <div className="flex items-center justify-between border-t border-line py-1.5">
              <span className="text-orange-700">
                Mes vacío {empty.names.length > 0 && `(${empty.names.join(" y ")}${empty.count > 2 ? "…" : ""})`}
                <InfoTip label="Qué es el mes vacío">
                  La residencia reserva tu lugar durante {empty.count === 1 ? "el mes completo" : `los ${empty.count} meses completos`}{" "}
                  entre hoy y tu ingreso, al {emptyPercent}% de la renta mensual. Lo define cada residencia en su
                  configuración.
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

          {fee && (
            <div className="mt-1 rounded-field border border-orange/40 bg-warning-bg px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-warning-fg">
                  Fee EstuRed (5%)
                  <InfoTip label="Cómo funciona el fee">
                    Único cobro de EstuRed: 5% del total de la reserva. Se abona únicamente si la residencia
                    confirma tu reserva — enviar la solicitud no cuesta nada.
                  </InfoTip>
                </span>
                <span className="text-right font-extrabold text-warning-fg">
                  {formatUsd(feeUsd)}
                  <span className="block text-[10px] font-normal">≈ {formatArs(fee.estimatedFeeArs)}</span>
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-warning-fg/90">
                Se abona solo al confirmarse la reserva. Enviar la solicitud es gratis.
              </p>
            </div>
          )}
        </div>
      )}

      <Textarea
        label="¿Cuál es tu objetivo académico?"
        id="apply-objective"
        name="academic_objective"
        rows={3}
        placeholder="Ej: Iniciar mi carrera universitaria en CABA durante el ciclo lectivo actual."
        hint="Obligatorio — se usa para tu comprobante de reserva."
        required
      />

      <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink-soft">
        <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--color-forest)]" />
        Leí y acepto las condiciones y el reglamento de convivencia de la residencia.
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar solicitud de reserva"}
      </Button>
    </form>
  );
}
