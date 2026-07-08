"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { respondNegotiationProposal } from "@/app/students/applications/[id]/negotiation/actions";

export function NegotiationResponse({ applicationId }: { applicationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRejectChoice, setShowRejectChoice] = useState(false);

  function respond(response: "accepted" | "rejected_chose_original" | "rejected_closed") {
    setError(null);
    startTransition(async () => {
      const result = await respondNegotiationProposal(applicationId, response);
      if (result?.status === "error") setError(result.message ?? "Ocurrió un error.");
    });
  }

  if (showRejectChoice) {
    return (
      <Card className="mt-6 p-6">
        <p className="font-semibold text-ink">
          ¿Querés continuar con las condiciones originales de la solicitud o cerrarla?
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-2 text-sm font-medium text-danger-fg">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" disabled={isPending} onClick={() => setShowRejectChoice(false)}>
            Volver
          </Button>
          <Button variant="outline" disabled={isPending} onClick={() => respond("rejected_chose_original")}>
            Continuar con condiciones originales
          </Button>
          <Button disabled={isPending} onClick={() => respond("rejected_closed")}>
            Cerrar solicitud
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-4 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" disabled={isPending} onClick={() => setShowRejectChoice(true)}>
          Rechazar
        </Button>
        <Button size="lg" disabled={isPending} onClick={() => respond("accepted")}>
          {isPending ? "Guardando…" : "Aceptar propuesta"}
        </Button>
      </div>
    </div>
  );
}
