"use client";

import { useActionState } from "react";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { savePaymentSettings, type SavePaymentSettingsState } from "@/app/admin/payment-settings/actions";

const initialState: SavePaymentSettingsState = { status: "idle" };

export type PaymentSettingsDefaults = {
  account_holder: string;
  alias: string;
  cbu: string;
  bank_name: string;
  holder_cuit: string;
  instructions: string;
};

function Field({
  label,
  name,
  defaultValue,
  error,
  hint,
  placeholder,
  inputMode,
  maxLength,
  required = true,
  textarea = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
  maxLength?: number;
  required?: boolean;
  textarea?: boolean;
}) {
  const common = {
    id: name,
    name,
    defaultValue,
    placeholder,
    maxLength,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${name}-error` : hint ? `${name}-hint` : undefined,
    className: "mt-1.5 w-full rounded-field border bg-white px-3 py-2 text-sm",
    style: { borderColor: error ? cmd.rose : cmd.outline, color: cmd.onSurface },
  };
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold" style={{ color: cmd.onSurface }}>
        {label}
        {!required && (
          <span className="ml-1 font-normal" style={{ color: cmd.outline }}>
            (opcional)
          </span>
        )}
      </label>
      {textarea ? <textarea rows={3} {...common} /> : <input type="text" inputMode={inputMode} {...common} />}
      {error ? (
        <p id={`${name}-error`} role="alert" className="mt-1 text-xs font-medium" style={{ color: cmd.rose }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-xs" style={{ color: cmd.outline }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PaymentSettingsForm({ defaults }: { defaults: PaymentSettingsDefaults }) {
  const [state, formAction, isPending] = useActionState(savePaymentSettings, initialState);
  // Si falló la validación, se conserva lo tipeado; si no, lo guardado.
  const v = state.status === "error" && state.values ? { ...defaults, ...state.values } : defaults;
  const e = state.errors ?? {};

  return (
    <AdminCard className="mt-6 p-6">
      <form action={formAction} className="space-y-4" key={state.status === "saved" ? "saved" : "form"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titular de la cuenta" name="account_holder" defaultValue={v.account_holder} error={e.accountHolder} maxLength={120} />
          <Field label="Banco" name="bank_name" defaultValue={v.bank_name} error={e.bankName} maxLength={80} />
          <Field
            label="Alias"
            name="alias"
            defaultValue={v.alias}
            error={e.alias}
            maxLength={20}
            hint="6 a 20 caracteres: letras, números, puntos o guiones."
          />
          <Field
            label="CBU"
            name="cbu"
            defaultValue={v.cbu}
            error={e.cbu}
            inputMode="numeric"
            maxLength={26}
            hint="22 dígitos. Validamos el dígito verificador."
          />
          <Field
            label="CUIT/CUIL del titular"
            name="holder_cuit"
            defaultValue={v.holder_cuit}
            error={e.holderCuit}
            inputMode="numeric"
            maxLength={14}
            required={false}
            hint="Si corresponde mostrarlo: 11 dígitos, con o sin guiones."
          />
        </div>
        <Field
          label="Indicaciones para el pago"
          name="instructions"
          defaultValue={v.instructions}
          error={e.instructions}
          maxLength={500}
          required={false}
          textarea
          hint="Opcional, hasta 500 caracteres. Ej.: horarios en que se acreditan las transferencias."
        />

        {state.status === "error" && state.message && (
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
          {isPending ? "Guardando…" : "Guardar datos de cobro"}
        </AdminButton>
      </form>
    </AdminCard>
  );
}
