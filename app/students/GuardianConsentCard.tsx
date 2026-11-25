"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { GUARDIAN_CONSENT_LABEL } from "@/lib/legal/clauses";
import { giveGuardianConsent, type GuardianConsentState } from "@/app/students/guardianConsentActions";

const initial: GuardianConsentState = { status: "idle" };

/** DR65 (e): tarjeta del familiar para dar el consentimiento por un estudiante menor (TP-07). */
export function GuardianConsentCard({ studentProfileId, studentName }: { studentProfileId: string; studentName: string }) {
  const [state, action, pending] = useActionState(giveGuardianConsent.bind(null, studentProfileId), initial);
  if (state.status === "saved") {
    return (
      <p role="status" className="rounded-card bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
        Listo. La cuenta de {studentName} ya está activa.
      </p>
    );
  }
  return (
    <form action={action} className="rounded-card border-[1.5px] border-amber-soft-300 bg-paper p-5">
      <h2 className="text-lg font-bold text-ink">La cuenta de {studentName} espera tu consentimiento</h2>
      <p className="mt-1 text-sm text-ink-soft">Como es menor de 18, necesita que su padre, su madre o su tutor acepte las condiciones.</p>
      <label className="mt-3 flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" name="accept_guardian_consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
        <span>
          {GUARDIAN_CONSENT_LABEL} (Estudiante: {studentName}.){" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">
            Términos
          </a>{" "}
          ·{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">
            Privacidad
          </a>
        </span>
      </label>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? "Guardando…" : "Dar mi consentimiento"}
      </Button>
    </form>
  );
}
