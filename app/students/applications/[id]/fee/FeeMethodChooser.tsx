"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import type { FeeMethodChoice } from "@/lib/payments/feeCollection";
import { chooseFeePaymentMethod, type FeeMethodState } from "@/app/students/applications/[id]/fee/payerActions";

const initialState: FeeMethodState = { status: "idle" };

/**
 * Elección del medio de pago del fee (DR64 (b)). Ningún medio viene preseleccionado, salvo que haya uno solo o ya se haya elegido.
 * Elegir congela los datos de cobro en el servidor; se puede cambiar hasta informar el pago. Sin chosen es la acción principal.
 */
export function FeeMethodChooser({
  applicationId,
  methods,
  chosenKey,
  amountArs,
  amountUsd,
}: {
  applicationId: string;
  methods: FeeMethodChoice[];
  chosenKey: string | null;
  amountArs: number;
  amountUsd: number | null;
}) {
  const action = chooseFeePaymentMethod.bind(null, applicationId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [selected, setSelected] = useState<string>(chosenKey ?? (methods.length === 1 ? methods[0].key : ""));
  const unchanged = selected === chosenKey;

  return (
    <form action={formAction} className="mt-6">
      <fieldset>
        <legend className="text-base font-bold text-ink">{chosenKey ? "Medio de pago" : "¿Con qué medio vas a pagar?"}</legend>
        <div className="mt-3 space-y-2">
          {methods.map((m) => {
            const amount = m.currency === "USD" ? (amountUsd === null ? null : formatUsd(amountUsd)) : formatArs(amountArs);
            return (
              <label
                key={m.key}
                className="flex cursor-pointer items-center gap-3 rounded-field border-[1.5px] border-line-2 bg-paper px-4 py-3 text-sm has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest"
              >
                <input
                  type="radio"
                  name="method_key"
                  value={m.key}
                  checked={selected === m.key}
                  onChange={() => setSelected(m.key)}
                  className="h-4 w-4 accent-forest"
                />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold text-ink">{m.label}</span>
                  {amount && <span className="tabular-nums text-ink-soft">Pagás {amount}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}

      <Button type="submit" variant={chosenKey ? "outline" : "primary"} size="sm" className="mt-3 w-full sm:w-auto" disabled={!selected || unchanged || isPending}>
        {isPending ? "Guardando…" : chosenKey ? "Cambiar a este medio" : "Usar este medio"}
      </Button>
    </form>
  );
}
