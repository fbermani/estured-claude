"use client";

import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import {
  importFeeCollectionFromSettings,
  saveFeeCollectionMethod,
  type FeeMethodFormState,
} from "@/app/admin/payment-settings/actions";
import { Input, Select, Textarea } from "@/components/ui/Input";

const initialState: FeeMethodFormState = { status: "idle" };

export type FeeMethodFormDefaults = {
  key: string;
  label: string;
  hint: string;
  requiresLabel: boolean;
  customLabel: string;
  details: string;
  currency: "ARS" | "USD";
  isEnabled: boolean;
};

/** Un medio del catálogo: habilitado, moneda y datos de cobro. Solo lo renderiza un superadmin (la acción lo vuelve a verificar). */
export function FeeCollectionMethodForm({ defaults }: { defaults: FeeMethodFormDefaults }) {
  const [state, formAction, isPending] = useActionState(saveFeeCollectionMethod, initialState);
  const id = `fee-method-${defaults.key}`;

  return (
    <form action={formAction} className="space-y-3 pt-3" key={state.status === "saved" ? "saved" : "form"}>
      <input type="hidden" name="method_key" value={defaults.key} />
      <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: cmd.onSurface }}>
        <input type="checkbox" name="is_enabled" defaultChecked={defaults.isEnabled} className="h-4 w-4" style={{ accentColor: cmd.primary }} />
        Habilitado para cobrar el fee
      </label>
      {defaults.requiresLabel && (
        <div>
          <Input label="Nombre del medio" id={`${id}-label`} name="label" type="text" maxLength={60} defaultValue={defaults.customLabel} />
        </div>
      )}
      <div>
        <Select label="Moneda en la que se cobra" id={`${id}-currency`} name="currency" defaultValue={defaults.currency}>
          <option value="ARS">Pesos (ARS)</option>
          <option value="USD">Dólares (USD)</option>
        </Select>
      </div>
      <div>
        <Textarea
          label="Datos de cobro"
          id={`${id}-details`}
          name="details"
          rows={4}
          maxLength={500}
          defaultValue={defaults.details}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="mt-1 text-xs" style={{ color: cmd.outline }}>
          {defaults.hint} Hasta 500 caracteres. Se muestran solo a quien tiene un fee por pagar.
        </p>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="text-sm font-medium" style={{ color: cmd.emerald }}>
          {state.message}
        </p>
      )}
      <AdminButton type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar"}
      </AdminButton>
    </form>
  );
}

/** «Importar la cuenta actual»: crea «Transferencia en pesos» desde `payment_settings` por server action. */
export function ImportFeeCollectionButton() {
  const [state, formAction, isPending] = useActionState(importFeeCollectionFromSettings, initialState);
  return (
    <form action={formAction} className="mt-3">
      <AdminButton type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Importando…" : "Importar la cuenta actual"}
      </AdminButton>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="mt-2 text-sm font-medium" style={{ color: cmd.emerald }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
