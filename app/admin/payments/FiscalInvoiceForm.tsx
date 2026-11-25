"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { registerFiscalInvoiceAction, type MarkFeePaidState } from "@/app/admin/payments/actions";

const initialState: MarkFeePaidState = { status: "idle" };

/** LEG-002: carga del número de Factura C emitida a mano en ARCA (punto de venta y número) y su fecha. */
export function FiscalInvoiceForm({ feePaymentId }: { feePaymentId: string }) {
  const id = useId();
  const [state, formAction] = useActionState(registerFiscalInvoiceAction.bind(null, feePaymentId), initialState);
  return (
    <form action={formAction} className="flex min-w-[220px] flex-col gap-1.5">
      <label htmlFor={`${id}-n`} className="text-xs font-semibold" style={{ color: cmd.onSurfaceVariant }}>
        N.º de Factura C
      </label>
      <input
        id={`${id}-n`}
        name="invoice_number"
        required
        inputMode="numeric"
        placeholder="00001-00000123"
        className="rounded border px-2 py-1 text-sm tabular-nums"
        style={{ borderColor: cmd.border }}
      />
      <label htmlFor={`${id}-d`} className="text-xs font-semibold" style={{ color: cmd.onSurfaceVariant }}>
        Fecha de emisión
      </label>
      <input id={`${id}-d`} name="issued_on" type="date" required className="rounded border px-2 py-1 text-sm" style={{ borderColor: cmd.border }} />
      <SubmitButton />
      {state.status === "error" && (
        <p role="alert" className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="secondary" disabled={pending}>
      {pending ? "Guardando…" : "Registrar factura"}
    </AdminButton>
  );
}
