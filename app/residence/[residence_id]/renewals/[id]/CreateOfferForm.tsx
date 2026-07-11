"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { ADJUSTMENT_POLICY_OPTIONS } from "@/lib/residences/options";
import {
  createRenewalOfferAction,
  type RenewalOfferFormState,
} from "@/app/residence/[residence_id]/renewals/actions";

const initialState: RenewalOfferFormState = { status: "idle" };

export function CreateOfferForm({
  reservationId,
  residenceId,
  renewalRequestId,
  currentMonthlyPriceUsd,
  currentDurationMonths,
}: {
  reservationId: string;
  residenceId: string;
  renewalRequestId: string | null;
  currentMonthlyPriceUsd: number;
  currentDurationMonths: number;
}) {
  const action = createRenewalOfferAction.bind(null, reservationId, residenceId, renewalRequestId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-bold text-petrol-800">Ofrecer renovación</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Tarifa actual: USD {currentMonthlyPriceUsd} · Duración actual: {currentDurationMonths} meses.
      </p>
      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Fecha de inicio del nuevo período" name="period_start_date" type="date" required />
        <Input
          label="Duración (meses)"
          name="duration_months"
          type="number"
          min={1}
          max={24}
          defaultValue={currentDurationMonths}
          required
        />
        <Input
          label="Nueva tarifa mensual (USD)"
          name="monthly_price_usd"
          type="number"
          min={0}
          step="0.01"
          defaultValue={currentMonthlyPriceUsd}
          required
        />
        <Input
          label="Matrícula o cargo de renovación (USD, opcional)"
          name="enrollment_or_renewal_fee_usd"
          type="number"
          min={0}
          step="0.01"
        />
        <Input label="Depósito (USD, opcional)" name="deposit_usd" type="number" min={0} step="0.01" />
        <Select label="Política de ajustes" name="adjustment_policy" defaultValue="quarterly" required>
          {ADJUSTMENT_POLICY_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
        <Input
          label="Días para que el estudiante responda"
          name="acceptance_deadline_days"
          type="number"
          min={1}
          max={30}
          defaultValue={7}
          required
        />

        {state.status === "error" && (
          <p role="alert" className="sm:col-span-2 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}

        <div className="flex gap-3 sm:col-span-2">
          <Button type="submit" name="send_now" value="" variant="outline" disabled={isPending}>
            Guardar borrador
          </Button>
          <Button type="submit" name="send_now" value="on" disabled={isPending}>
            {isPending ? "Enviando…" : "Enviar oferta de renovación"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
