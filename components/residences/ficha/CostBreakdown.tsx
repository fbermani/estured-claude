"use client";

import { Icon } from "@/components/ui/Icon";
import { InfoTip } from "@/components/ui/InfoTip";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { calculateFeeEstimate, FEE_PERCENT } from "@/lib/applications/fee";
import { type InitialPaymentConfig } from "@/lib/reservations/initialPayment";
import { emptyMonthsChargeUsd, MAX_EMPTY_MONTHS } from "@/lib/applications/emptyMonths";
import { resolveReservationMoney, todayIso, type DepositMode } from "@/lib/applications/reservationMoney";

/** Condiciones de reserva a nivel residencia (migración 0025) que entran en el desglose. */
export interface CostBreakdownConditions {
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
  enrollmentFeeFrequency: "once" | "annual";
  depositUsd: number | null;
  emptyMonthChargePercent: number | null;
  /** Pago inicial para reservar a la residencia (D7/H08): primer mes, monto fijo o solo la matrícula (DR18 t3). */
  initialPayment: InitialPaymentConfig;
  /** DR18 t3 (migración 0060); opcionales: sin ellos todo se calcula como antes. */
  depositMode?: DepositMode | null;
  enrollmentDiscountPercent?: number | null;
  enrollmentDiscountUntil?: string | null;
}

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
 * Desglose de costos de una reserva (renta × meses, matrícula, mes vacío, depósito, total, pago inicial a la
 * residencia y fee de EstuRed), compartido entre la solicitud del estudiante (`ApplyForm`) y la propuesta del
 * familiar (`ProposeForm`, DR4). Es solo informativo: el servidor recalcula todo al enviar.
 */
export function CostBreakdown({
  monthlyUsd: listMonthlyUsd,
  promotionPercent = null,
  duration,
  startDate,
  conditions,
  arsPerUsd,
  submitNoun = "solicitud",
}: {
  /** Qué se envía (el estudiante envía una solicitud; el familiar, una propuesta): solo cambia el texto. */
  submitNoun?: "solicitud" | "propuesta";
  /** Tarifa de lista del tipo elegido; la promoción vigente (si hay) se aplica acá, igual que en el servidor. */
  monthlyUsd: number;
  promotionPercent?: number | null;
  duration: number;
  /** "YYYY-MM-DD" o vacío si todavía no se eligió. */
  startDate: string;
  conditions: CostBreakdownConditions;
  arsPerUsd: number;
}) {
  // Misma resolución que el snapshot del servidor (`resolveReservationMoney`): promoción, descuento de matrícula, depósito y pago inicial.
  const money = resolveReservationMoney({
    listMonthlyUsd,
    promotionPercent,
    conditions,
    arsPerUsd,
    today: todayIso(),
  });
  const monthlyUsd = money.monthlyUsd;
  const enrollmentUsd = money.enrollment.netUsd;
  const depositUsd = money.depositUsd ?? 0;
  const emptyPercent = conditions.emptyMonthChargePercent;

  // Mes vacío (DR18 t3): solo se cobra si la plaza queda realmente vacía, así que es un POSIBLE cargo informativo: no suma al total
  // ni a la base del fee.
  const empty = startDate
    ? emptyMonthsChargeUsd({ desiredStartDate: startDate, monthlyPriceUsd: monthlyUsd, chargePercent: emptyPercent })
    : { months: 0, chargeUsd: 0 };
  const emptyNames = emptyMonthNames(empty.months);
  const emptyChargeUsd = empty.chargeUsd;
  const rentTotalUsd = monthlyUsd * duration;
  const reservationTotalUsd = rentTotalUsd + enrollmentUsd;
  const fee = calculateFeeEstimate({
    monthlyPriceUsd: monthlyUsd,
    durationMonths: duration,
    enrollmentFeeUsd: enrollmentUsd,
    arsPerUsd,
  });
  const feeUsd = reservationTotalUsd * FEE_PERCENT;
  const initialPayment = money.initialPayment;

  return (
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
            {formatUsd(monthlyUsd)} por mes durante {duration} {duration === 1 ? "mes" : "meses"} de estadía. Se paga mes
            a mes directamente a la residencia.
          </InfoTip>
        </span>
        <span className="font-bold text-ink">{formatUsd(rentTotalUsd)}</span>
      </div>
      {money.promotionPercent > 0 && (
        <p className="-mt-1 pb-1 text-xs font-semibold text-forest-700">
          Promoción vigente: −{money.promotionPercent}% (antes{" "}
          <span className="line-through">{formatUsd(listMonthlyUsd)}</span> por mes, ahora {formatUsd(monthlyUsd)}).
        </p>
      )}
      <p className="-mt-1 pb-1.5 text-xs text-ink-faint">
        ≈ {formatArs(usdToArsRounded(monthlyUsd, arsPerUsd))} por mes, referencial
        <ExchangeRateNote />
      </p>

      {money.enrollment.listUsd > 0 && (
        <div className="flex items-center justify-between border-t border-line py-1.5">
          <span className="text-ink-soft">
            Matrícula {conditions.enrollmentFeeFrequency === "annual" ? "(anual)" : "(única vez)"}
            <InfoTip label="Qué es la matrícula">
              Cargo administrativo de ingreso que define la residencia
              {conditions.enrollmentFeeMode === "one_month" ? ", equivalente a 1 mes de renta" : ""}. No es reembolsable y
              forma parte de la base del fee de EstuRed.
              {conditions.enrollmentFeeFrequency === "annual" && " Se renueva cada año de estadía."}
            </InfoTip>
          </span>
          <span className="text-right font-bold text-ink">
            {money.enrollment.discountPercent > 0 && (
              <span className="mr-1.5 text-xs font-semibold text-ink-faint line-through">{formatUsd(money.enrollment.listUsd)}</span>
            )}
            {enrollmentUsd > 0 ? formatUsd(enrollmentUsd) : "Bonificada"}
            {money.enrollment.discountPercent > 0 && (
              <span className="block text-[10px] font-normal text-forest-700">
                {money.enrollment.discountPercent >= 100 ? "Sin costo por ahora" : `${money.enrollment.discountPercent}% de descuento`}
              </span>
            )}
          </span>
        </div>
      )}

      {emptyChargeUsd > 0 && (
        <div className="flex items-center justify-between border-t border-line py-1.5">
          <span className="text-orange-700">
            Posible mes vacío {emptyNames.length > 0 && `(${emptyNames.join(" y ")}${empty.months > 2 ? "…" : ""})`}
            <InfoTip label="Qué es el mes vacío">
              Si entre hoy y tu ingreso hay {empty.months === 1 ? "un mes completo" : `hasta ${empty.months} meses completos`} (máximo{" "}
              {MAX_EMPTY_MONTHS}) en los que la plaza queda realmente vacía, la residencia puede cobrar el {emptyPercent}% de la renta por
              cada uno. Solo se cobra en ese caso, nunca por toda reserva con ingreso diferido, y no suma al total ni al fee. Lo acordás con
              la residencia.
            </InfoTip>
          </span>
          <span className="text-right font-bold text-orange-700">
            hasta {formatUsd(emptyChargeUsd)}
            <span className="block text-[10px] font-normal text-ink-faint">solo si queda vacía</span>
          </span>
        </div>
      )}

      {depositUsd > 0 && (
        <div className="flex items-center justify-between border-t border-line py-1.5">
          <span className="text-ink-soft">
            Depósito
            <InfoTip label="Qué es el depósito">
              Monto que la residencia te devuelve al irte, según sus condiciones (por ejemplo, si no hay daños). Se paga directamente a la residencia y no
              forma parte de la base del fee EstuRed.
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
            Renta × meses + matrícula{money.enrollment.discountPercent > 0 ? " (ya con su descuento)" : ""}. No incluye el depósito
            (reembolsable) ni un posible mes vacío. Es el monto sobre el que se calcula el fee de EstuRed.
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
                : initialPayment.mode === "enrollment_only"
                  ? "La residencia pide solo la matrícula para reservar."
                  : "La residencia pide el primer mes de renta para reservar."}{" "}
              Se paga directamente a la residencia, no a EstuRed, antes de la fecha límite: aparece en la solicitud
              cuando la residencia habilita el pago.
            </InfoTip>
            <span className="block text-[11px] font-normal text-ink-faint">
              Pago inicial para reservar
              {initialPayment.mode === "one_month" ? " (primer mes)" : initialPayment.mode === "enrollment_only" ? " (solo la matrícula)" : ""}
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

      <div className="mt-2 rounded-field border border-orange/40 bg-warning-bg px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-warning-fg">
            A EstuRed: fee ({Math.round(FEE_PERCENT * 100)}%)
            <InfoTip label="Cómo funciona el fee">
              Único cobro de EstuRed: 5% del total de la reserva. Se abona únicamente si la residencia confirma la
              reserva — enviar la {submitNoun} no cuesta nada.
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
          Se abona solo al confirmarse la reserva. Enviar la {submitNoun} es gratis.
        </p>
      </div>
    </div>
  );
}
