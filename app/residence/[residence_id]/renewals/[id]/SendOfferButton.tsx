"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  sendRenewalOfferAction,
  type RenewalOfferFormState,
} from "@/app/residence/[residence_id]/renewals/actions";

const initialState: RenewalOfferFormState = { status: "idle" };

export function SendOfferButton({
  offerId,
  residenceId,
  reservationId,
}: {
  offerId: string;
  residenceId: string;
  reservationId: string;
}) {
  const action = sendRenewalOfferAction.bind(null, offerId, residenceId, reservationId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar oferta al estudiante"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </form>
  );
}
