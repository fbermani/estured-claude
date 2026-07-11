"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { respondRenewalOfferAction, type RenewalFormState } from "@/app/students/renewals/actions";

const initialState: RenewalFormState = { status: "idle" };

export function RespondOfferForm({ offerId }: { offerId: string }) {
  const acceptAction = respondRenewalOfferAction.bind(null, offerId, "accepted");
  const rejectAction = respondRenewalOfferAction.bind(null, offerId, "rejected");
  const [acceptState, acceptFormAction, isAccepting] = useActionState(acceptAction, initialState);
  const [rejectState, rejectFormAction, isRejecting] = useActionState(rejectAction, initialState);

  const error = acceptState.status === "error" ? acceptState.message : rejectState.status === "error" ? rejectState.message : null;

  return (
    <div className="mt-6 space-y-3">
      {error && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <form action={rejectFormAction}>
          <Button type="submit" variant="outline" disabled={isAccepting || isRejecting}>
            {isRejecting ? "Enviando…" : "Rechazar oferta"}
          </Button>
        </form>
        <form action={acceptFormAction}>
          <Button type="submit" disabled={isAccepting || isRejecting}>
            {isAccepting ? "Enviando…" : "Aceptar oferta"}
          </Button>
        </form>
      </div>
    </div>
  );
}
