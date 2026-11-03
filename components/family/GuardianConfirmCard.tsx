"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { resolveGuardianConfirmationAction } from "@/app/students/dashboard/guardianActions";

type Props = { id: string; studentName: string; residenceName: string; expiresLabel: string };

/** Tarjeta del tutor: confirmar o rechazar la estadía de un menor (DR32). Dos botones, sin jerga; sin promesas de disponibilidad. */
export function GuardianConfirmCard({ id, studentName, residenceName, expiresLabel }: Props) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function decide(decision: "confirm" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await resolveGuardianConfirmationAction({ confirmationId: id, decision });
      if (result.ok) setDone(decision);
      else setError(result.message);
    });
  }

  if (done) {
    return (
      <Card className="p-4 sm:p-5">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name={done === "confirm" ? "check_circle" : "info"} className="text-xl text-forest-700" />
          {done === "confirm" ? `Listo: la estadía de ${studentName} quedó confirmada.` : `Listo: avisamos a ${studentName} que no la confirmaste.`}
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-amber-soft-300 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft-100 text-amber-soft-700">
          <Icon name="how_to_reg" className="text-xl" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-ink">¿Confirmás la estadía de {studentName}?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {studentName} pidió vincular su estadía en <strong className="text-ink">{residenceName}</strong>. Hasta que confirmes no queda activa.
          </p>
          <p className="mt-1 text-xs text-ink-faint">Respondé antes del {expiresLabel}.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="lg" disabled={pending} onClick={() => decide("confirm")} className="min-h-11 sm:flex-1">
          {pending ? "Guardando…" : "Confirmar estadía"}
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={pending} onClick={() => decide("reject")} className="min-h-11 sm:flex-1">
          No es correcta
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-fg">
          {error}
        </p>
      )}
    </Card>
  );
}
