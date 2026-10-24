"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { designateFeePayer, type DesignatePayerState } from "@/app/students/applications/[id]/fee/payerActions";

const initialState: DesignatePayerState = { status: "idle" };

/** Para el estudiante: quién paga el fee (DR4). El cambio se puede hacer mientras no haya un comprobante cargado. */
export function FeePayerCard({
  applicationId,
  familyName,
  otherIsPayer,
  payerIsLinkedFamily,
}: {
  applicationId: string;
  /** Nombre del familiar vinculado activo; `null` si ya no hay uno (vínculo revocado). */
  familyName: string | null;
  /** `true` si hoy el pagador designado NO es el estudiante (familiar actual o ex familiar). */
  otherIsPayer: boolean;
  /** `true` si el pagador designado es el familiar vinculado activo (y no un ex familiar). */
  payerIsLinkedFamily: boolean;
}) {
  const target = otherIsPayer ? "self" : "family";
  const action = designateFeePayer.bind(null, applicationId, target);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-start gap-3">
        <Icon name="family_restroom" className="mt-0.5 text-xl text-forest-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">¿Quién paga el fee?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {otherIsPayer
              ? payerIsLinkedFamily
                ? `El pago lo hace ${familyName}: ve los datos de transferencia y registra el comprobante. Los datos de facturación del pago quedan a su nombre.`
                : "El pagador designado ya no está vinculado con vos. Podés pagarlo vos para ver los datos de transferencia y registrar el comprobante."
              : `Podés pagarlo vos o dejar que lo pague ${familyName}, tu familiar vinculado. Si lo designás, él o ella ve el monto, los datos de transferencia y el plazo.`}
          </p>
          <form action={formAction} className="mt-3">
            <Button type="submit" size="sm" variant="outline" disabled={isPending}>
              {isPending ? "Guardando…" : otherIsPayer ? "Prefiero pagarlo yo" : `Que lo pague ${familyName}`}
            </Button>
          </form>
          {state.status === "error" && (
            <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
              {state.message}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
