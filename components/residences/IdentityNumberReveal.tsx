"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { requestStudentIdentityNumber } from "@/lib/documents/requestStudentIdentityNumber";

/**
 * DR58 fase 2: «Ver número» de documento. El número no viaja con la pantalla: se pide al servidor al hacer clic, que vuelve a
 * autorizar y registra la lectura. Se muestra en el momento y no se guarda en ningún estado persistente.
 */
export function IdentityNumberReveal({ residenceId, studentProfileId }: { residenceId: string; studentProfileId: string }) {
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<{ typeLabel: string; number: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setPending(true);
    setError(null);
    try {
      const result = await requestStudentIdentityNumber(residenceId, studentProfileId);
      if (result.ok) setRevealed({ typeLabel: result.typeLabel, number: result.number });
      else setError(result.error);
    } catch {
      setError("No pudimos mostrar el documento. Probá de nuevo en un rato.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-field bg-cream-2 px-3 py-2 text-sm">
      <span className="font-medium text-ink">Número de documento</span>
      {revealed ? (
        <span className="flex items-center gap-2 tabular-nums text-ink">
          <span className="text-xs text-ink-faint">{revealed.typeLabel}</span>
          <span className="font-semibold">{revealed.number}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-field px-1.5 py-0.5 text-xs font-semibold text-forest-700 underline underline-offset-2 hover:text-forest-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50"
        >
          <Icon name="visibility" className="text-sm" />
          {pending ? "Abriendo…" : "Ver número"}
        </button>
      )}
      {error && (
        <span role="alert" className="w-full text-right text-xs font-medium text-danger-fg">
          {error}
        </span>
      )}
    </div>
  );
}
