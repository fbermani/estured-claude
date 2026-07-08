"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ADJUSTMENT_POLICY_OPTIONS } from "@/lib/residences/options";
import { formatUsd } from "@/lib/mock/exchange";
import {
  sendNegotiationProposal,
  type SendProposalState,
} from "@/app/residence/[residence_id]/applications/[id]/negotiation/actions";

interface Original {
  monthly_price_usd: number;
  enrollment_fee_usd: number | null;
  deposit_usd: number | null;
  initial_duration_months: number;
  reservation_payment_amount_usd: number;
  adjustment_policy: string;
}

const initialState: SendProposalState = { status: "idle" };

export function NegotiationForm({
  applicationId,
  residenceId,
  original,
}: {
  applicationId: string;
  residenceId: string;
  original: Original;
}) {
  const action = sendNegotiationProposal.bind(null, applicationId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState<string>("");
  const [enrollmentFee, setEnrollmentFee] = useState<string>("");
  const [deposit, setDeposit] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [reservationAmount, setReservationAmount] = useState<string>("");
  const [specialConditions, setSpecialConditions] = useState<string>("");

  const comparisonRows = useMemo(
    () => [
      {
        label: "Tarifa mensual",
        original: formatUsd(original.monthly_price_usd),
        proposed: monthlyPrice ? formatUsd(Number(monthlyPrice)) : "Sin cambios",
      },
      {
        label: "Matrícula",
        original: original.enrollment_fee_usd ? formatUsd(original.enrollment_fee_usd) : "—",
        proposed: enrollmentFee ? formatUsd(Number(enrollmentFee)) : "Sin cambios",
      },
      {
        label: "Depósito",
        original: original.deposit_usd ? formatUsd(original.deposit_usd) : "—",
        proposed: deposit ? formatUsd(Number(deposit)) : "Sin cambios",
      },
      {
        label: "Duración",
        original: `${original.initial_duration_months} meses`,
        proposed: duration ? `${duration} meses` : "Sin cambios",
      },
      {
        label: "Fecha de ingreso",
        original: "Original de la solicitud",
        proposed: startDate || "Sin cambios",
      },
      {
        label: "Monto para reservar",
        original: formatUsd(original.reservation_payment_amount_usd),
        proposed: reservationAmount ? formatUsd(Number(reservationAmount)) : "Sin cambios",
      },
    ],
    [original, monthlyPrice, enrollmentFee, deposit, duration, startDate, reservationAmount],
  );

  if (!acknowledged) {
    return (
      <Card className="mt-8 border-amber-soft-300 bg-warning-bg p-6">
        <h2 className="font-bold text-warning-fg">Antes de continuar</h2>
        <p className="mt-2 text-sm text-warning-fg">
          Solo podés enviar una propuesta de ajuste por solicitud. Una vez enviada, no podés
          modificarla. Asegurate de haber acordado todos los detalles con el estudiante antes de
          continuar.
        </p>
        <Button onClick={() => setAcknowledged(true)} className="mt-4">
          Entiendo, continuar
        </Button>
      </Card>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="warning_acknowledged" value="on" />

      <Card className="p-6">
        <h2 className="font-bold text-petrol-800">Condiciones a modificar</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Dejá en blanco lo que no cambia. Nunca podés modificar los datos del estudiante.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Nueva tarifa mensual (USD)"
            name="proposed_monthly_price_usd"
            type="number"
            min={0}
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(e.target.value)}
          />
          <Input
            label="Nueva matrícula (USD)"
            name="proposed_enrollment_fee_usd"
            type="number"
            min={0}
            value={enrollmentFee}
            onChange={(e) => setEnrollmentFee(e.target.value)}
          />
          <Input
            label="Nuevo depósito (USD)"
            name="proposed_deposit_usd"
            type="number"
            min={0}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
          <Input
            label="Nueva fecha de ingreso"
            name="proposed_start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Nueva duración (meses)"
            name="proposed_duration_months"
            type="number"
            min={1}
            max={24}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <Input
            label="Nuevo monto para reservar (USD)"
            name="proposed_reservation_payment_amount_usd"
            type="number"
            min={0}
            value={reservationAmount}
            onChange={(e) => setReservationAmount(e.target.value)}
          />
          <Select label="Nueva política de ajustes" name="proposed_adjustment_policy" defaultValue="">
            <option value="">Sin cambios</option>
            {ADJUSTMENT_POLICY_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label="Condiciones especiales o descuento (visible para el estudiante)"
          name="special_conditions"
          rows={2}
          value={specialConditions}
          onChange={(e) => setSpecialConditions(e.target.value)}
          className="mt-4"
        />
        <Textarea label="Notas internas (privadas)" name="internal_notes" rows={2} className="mt-4" />
      </Card>

      <Card className="overflow-hidden p-0">
        <p className="border-b border-sand-200 px-5 py-3 text-sm font-bold text-petrol-800">
          Vista previa — así lo va a ver {""}el estudiante
        </p>
        <table className="w-full text-sm">
          <thead className="bg-sand-100 text-left text-ink-soft">
            <tr>
              <th className="px-4 py-2 font-medium">Condición</th>
              <th className="px-4 py-2 font-medium">Original</th>
              <th className="px-4 py-2 font-medium">Propuesta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {comparisonRows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2 text-ink-soft">{row.label}</td>
                <td className="px-4 py-2 text-ink">{row.original}</td>
                <td className="px-4 py-2 font-medium text-petrol-700">{row.proposed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-petrol-600"
        />
        ¿Confirmás que esta es tu única propuesta de ajuste para esta solicitud?
      </label>

      <div className="flex gap-3">
        <Button href={`/residence/${residenceId}/applications/${applicationId}`} variant="outline">
          Cancelar
        </Button>
        <Button type="submit" disabled={!confirmed || isPending}>
          {isPending ? "Enviando…" : "Enviar propuesta definitiva"}
        </Button>
      </div>
    </form>
  );
}
