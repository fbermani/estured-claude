"use client";

import { Icon } from "@/components/ui/Icon";
import { InfoTip } from "@/components/ui/InfoTip";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { calculateFeeEstimate, FEE_PERCENT } from "@/lib/applications/fee";
import { type InitialPaymentConfig } from "@/lib/reservations/initialPayment";
import { confirmedEmptyMonthsCharge, MAX_EMPTY_MONTHS, type VacancyOutlook } from "@/lib/applications/emptyMonths";
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

/** Salida = entrada + N meses − 1 día (ref: 1 Mar + 6 meses → 31 Ago). */
function computeExitDate(entrada: string, months: number): string {
  const [y, m, d] = entrada.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + months, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return formatDateOnly(end.toISOString().slice(0, 10));
}

/**
 * Desglose de costos de una reserva (renta × meses, matrícula, mes vacío, depósito, total, pago inicial a la
 * residencia y fee de EstuRed), compartido entre la solicitud del estudiante (`ApplyForm`) y la propuesta del
 * familiar (`ProposeForm`, DR4). Es solo informativo: el servidor recalcula todo al enviar.
 */
export function CostBreakdown({
  monthlyUsd: listMonthlyUsd,
  promotionPercent = null,
  vacancy = null,
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
  /** Ocupación futura del tipo elegido (la arma el servidor con estadías y reservas reales); null = sin dato confiable → «a confirmar». */
  vacancy?: VacancyOutlook | null;
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

  // Mes vacío CONFIRMADO (docs/00 DR18 t3, correcciones): se cobra solo si la reserva es diferida y el tipo realmente no tiene
  // ocupación en los meses completos entre hoy y el ingreso. Mismo cálculo que el snapshot del servidor, que lo recalcula al enviar.
  const today = todayIso();
  const empty = confirmedEmptyMonthsCharge({
    desiredStartDate: startDate,
    monthlyPriceUsd: monthlyUsd,
    chargePercent: emptyPercent,
    vacancy,
    today,
  });
  const emptyChargeUsd = empty.chargeUsd;
  const emptyLabel = `${empty.months.toLocaleString("es-AR")} ${empty.months === 1 ? "mes" : "meses"}`;
  const rentTotalUsd = monthlyUsd * duration;
  const reservationTotalUsd = rentTotalUsd + enrollmentUsd + emptyChargeUsd;
  const fee = calculateFeeEstimate({
    monthlyPriceUsd: monthlyUsd,
    durationMonths: duration,
    enrollmentFeeUsd: enrollmentUsd,
    emptyMonthsChargeUsd: emptyChargeUsd,
    arsPerUsd,
  });
  const feeUsd = reservationTotalUsd * FEE_PERCENT;
  const initialPayment = money.initialPayment;

  const totalArs = usdToArsRounded(reservationTotalUsd, arsPerUsd);
  const initialLabel =
    initialPayment.mode === "one_month"
      ? "primer mes"
      : initialPayment.mode === "enrollment_only"
        ? "matrícula"
        : initialPayment.mode === "deposit_only"
          ? "depósito"
          : null;

  return (
    <div className="space-y-3 text-sm">
      {/* (a) DR30 §6: lo primero que se muestra del dinero es lo que se paga a la residencia para reservar. */}
      <section aria-label="Pago inicial a la residencia" className="rounded-field border-[1.5px] border-forest/30 bg-forest-tint/40 p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-forest-700">
          Pago inicial a la residencia para reservar{initialLabel ? ` (${initialLabel})` : ""}
          <InfoTip label="Qué es el pago inicial">
            {initialPayment.mode === "custom_usd"
              ? "Monto fijo que define la residencia para reservar."
              : initialPayment.mode === "enrollment_only"
                ? "La residencia pide la matrícula para reservar."
                : initialPayment.mode === "deposit_only"
                  ? "La residencia pide el depósito (reembolsable) para reservar."
                  : "La residencia pide el primer mes de renta para reservar."}{" "}
            Se paga directamente a la residencia, no a EstuRed, antes de la fecha límite: aparece en la solicitud
            cuando la residencia habilita el pago.
          </InfoTip>
        </p>
        <p className="mt-1.5 font-display text-3xl font-extrabold leading-none text-ink">
          {formatArs(initialPayment.arsDisplay)}
        </p>
        <p className="mt-1 text-xs font-semibold text-ink-soft">
          {formatUsd(initialPayment.usd)} ·{" "}
          <ExchangeRateNote showNote />
        </p>
        <p className="mt-2 text-xs leading-snug text-ink-soft">Se abona a la residencia una vez aprobada tu solicitud.</p>
      </section>

      {/* (b) Total de la reserva con detalle desplegable. */}
      <details className="group rounded-field border border-line bg-cream-2 px-4 py-1">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="font-bold text-ink">
            Total de la reserva
            <InfoTip label="Qué incluye el total">
              Renta × meses + matrícula{money.enrollment.discountPercent > 0 ? " (ya con su descuento)" : ""}
              {emptyChargeUsd > 0 ? " + mes vacío" : ""}. No incluye el depósito (reembolsable). Es el monto sobre el que se calcula el fee
              de EstuRed.
            </InfoTip>
            <span className="block text-xs font-semibold text-forest-700 underline-offset-2 group-open:hidden">Ver detalle</span>
            <span className="hidden text-xs font-semibold text-forest-700 underline-offset-2 group-open:block">Ocultar detalle</span>
          </span>
          <span className="flex items-center gap-1.5 text-right">
            <span>
              <span className="block font-extrabold text-ink">{formatUsd(reservationTotalUsd)}</span>
              <span className="block text-[10px] font-normal text-ink-faint">≈ {formatArs(totalArs)}</span>
            </span>
            <Icon name="expand_more" className="text-xl text-ink-faint transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-line pb-2 pt-3">
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
        ≈ {formatArs(usdToArsRounded(monthlyUsd, arsPerUsd))} por mes
        <ExchangeRateNote showNote />
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

      {empty.status === "charged" && (
        <div className="flex items-center justify-between border-t border-line py-1.5">
          <span className="text-orange-700">
            Mes vacío ({emptyLabel})
            <InfoTip label="Qué es el mes vacío">
              Reservás hoy para ingresar más adelante y la habitación está disponible desde {empty.vacantFrom ? formatDateOnly(empty.vacantFrom) : "hoy"}:
              la residencia te guarda la plaza y ese tiempo hasta tu ingreso, en que queda vacía, se cobra al {emptyPercent}% de la renta.
              Se cuenta en proporción a los días: más de 15 días extra cuentan como un mes y 15 o menos como medio mes (máximo {MAX_EMPTY_MONTHS} meses). Se
              confirma al enviar la solicitud, con la disponibilidad de ese momento. Se paga a la residencia y forma parte del total sobre
              el que se calcula el fee.
            </InfoTip>
          </span>
          <span className="text-right font-bold text-orange-700">{formatUsd(emptyChargeUsd)}</span>
        </div>
      )}
      {empty.status === "to_confirm" && (
        <div className="border-t border-line py-1.5 text-xs text-ink-soft">
          <span className="font-semibold text-orange-700">Mes vacío: a confirmar por la residencia.</span>{" "}
          Reservás con ingreso diferido y esta residencia cobra el {emptyPercent}% de la renta por cada mes en que la plaza queda realmente
          vacía antes de tu ingreso (máximo {MAX_EMPTY_MONTHS}). Todavía no tenemos la disponibilidad publicada para esas fechas: la residencia lo confirma y
          no se suma al total hasta entonces. Se confirma al enviar la solicitud.
        </div>
      )}
      {empty.status === "not_charged" && (
        <p className="border-t border-line py-1.5 text-xs text-ink-faint">
          Mes vacío: no aplica, ingresás cuando la plaza empieza a estar disponible o antes estaba ocupada (se confirma al enviar la solicitud).
        </p>
      )}

        </div>
      </details>

      {/* (c) Fee de EstuRed (5 % al estudiante). */}
      <div className="rounded-field border border-orange/40 bg-warning-bg px-3 py-2.5">
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

      {/* (d) Depósito, si hay: se abona al ingresar. */}
      {depositUsd > 0 && (
        <div className="rounded-field border border-line bg-paper px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <span className="text-ink-soft">
              <span className="font-semibold text-ink">Depósito</span>
              <InfoTip label="Qué es el depósito">
                Monto que la residencia te devuelve al irte, según sus condiciones (por ejemplo, si no hay daños). Se paga directamente a la residencia y no
                forma parte de la base del fee EstuRed.
              </InfoTip>
              <span className="block text-xs text-ink-faint">Se abona al ingresar a la residencia.</span>
            </span>
            <span className="text-right font-bold text-ink">
              {formatUsd(depositUsd)}
              <span className="block text-[10px] font-normal text-ink-faint">reembolsable</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
