"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { respondFamilyLink } from "@/app/students/family-link-actions";

export function FamilyLinkActions({ linkId }: { linkId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function respond(decision: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await respondFamilyLink(linkId, decision);
      if (result.status === "error") setError(result.message ?? "Ocurrió un error.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => respond("reject")}>
          Rechazar
        </Button>
        <Button size="sm" disabled={isPending} onClick={() => respond("approve")}>
          {isPending ? "Guardando…" : "Aprobar vínculo"}
        </Button>
      </div>
      {error && <p className="text-xs font-medium text-danger-fg">{error}</p>}
    </div>
  );
}
