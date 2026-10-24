"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { retryReservationConfirmationAction, type MarkFeePaidState } from "@/app/admin/payments/actions";

const initialState: MarkFeePaidState = { status: "idle" };

/** "Reintentar confirmación" (Ciclo 71, DR8): submit nativo + `useFormStatus` (sin `onClick` + `setState`). */
export function RetryConfirmationButton({ feePaymentId }: { feePaymentId: string }) {
  const [state, formAction] = useActionState(
    async () => retryReservationConfirmationAction(feePaymentId),
    initialState,
  );
  return (
    <form action={formAction} className="mt-2">
      <SubmitButton />
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="mt-2 text-sm font-medium" style={{ color: cmd.emerald }}>
          Reserva confirmada.
        </p>
      )}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="primary" disabled={pending}>
      {pending ? "Reintentando…" : "Reintentar confirmación"}
    </AdminButton>
  );
}
