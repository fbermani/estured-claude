"use client";

import { useActionState, useState, useTransition } from "react";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import {
  forceRefreshExchangeRate,
  removeExchangeRateOverride,
  setExchangeRateOverride,
  type ExchangeRateActionState,
} from "@/app/admin/exchange-rate/actions";

const initialState: ExchangeRateActionState = { status: "idle" };

export function ExchangeRateActions({ hasOverrideToday }: { hasOverrideToday: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [simpleResult, setSimpleResult] = useState<ExchangeRateActionState>(initialState);
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  const [overrideState, overrideFormAction, isOverridePending] = useActionState(
    setExchangeRateOverride,
    initialState,
  );

  function runSimpleAction(action: () => Promise<ExchangeRateActionState>) {
    startTransition(async () => {
      const result = await action();
      setSimpleResult(result);
    });
  }

  return (
    <AdminCard className="mt-4 p-6">
      <div className="flex flex-wrap gap-3">
        <AdminButton disabled={isPending} onClick={() => runSimpleAction(forceRefreshExchangeRate)}>
          {isPending ? "Actualizando…" : "Forzar actualización"}
        </AdminButton>
        {!showOverrideForm && (
          <AdminButton variant="ghost" onClick={() => setShowOverrideForm(true)}>
            Establecer override manual
          </AdminButton>
        )}
        {hasOverrideToday && (
          <AdminButton
            variant="danger"
            disabled={isPending}
            onClick={() => runSimpleAction(removeExchangeRateOverride)}
          >
            Quitar override
          </AdminButton>
        )}
      </div>

      {simpleResult.status !== "idle" && (
        <p
          className="mt-3 text-sm font-medium"
          style={{ color: simpleResult.status === "error" ? cmd.rose : cmd.emerald }}
        >
          {simpleResult.message}
        </p>
      )}

      {showOverrideForm && (
        <form action={overrideFormAction} className="mt-4 rounded border p-4" style={{ borderColor: cmd.border }}>
          <label className="block text-sm font-semibold" style={{ color: cmd.onSurface }}>
            Valor ARS por USD
          </label>
          <input
            name="ars_per_usd"
            type="number"
            step="0.01"
            min="0"
            required
            className="mt-1.5 w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: cmd.outline }}
            placeholder="Ej: 1520"
          />
          <label className="mt-4 block text-sm font-semibold" style={{ color: cmd.onSurface }}>
            Motivo (obligatorio)
          </label>
          <textarea
            name="reason"
            rows={2}
            required
            className="mt-1.5 w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: cmd.outline }}
            placeholder="Ej: monedapi.ar no responde desde hace 2 horas, uso el valor de referencia de otra casa de cambio"
          />
          {overrideState.status === "error" && (
            <p className="mt-2 text-sm font-medium" style={{ color: cmd.rose }}>
              {overrideState.message}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <AdminButton type="button" onClick={() => setShowOverrideForm(false)}>
              Cancelar
            </AdminButton>
            <AdminButton type="submit" variant="primary" disabled={isOverridePending}>
              {isOverridePending ? "Guardando…" : "Aplicar override"}
            </AdminButton>
          </div>
        </form>
      )}
    </AdminCard>
  );
}
