"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

type CaseState = { status: "idle" | "error" | "saved"; message?: string };
const initialState: CaseState = { status: "idle" };

/** Texto aprobado de la excepción (docs/propuestas/TEXTOS_PESOS_Y_PAGO_2026-11-26.md §5, DR73). */
export const PAYMENT_CASE_EXCEPTION =
  "Excepción: un caso sobre el pago de la reserva a la residencia frena el vencimiento de esa solicitud mientras siga abierto.";

/**
 * «Abrir un caso en Soporte» sobre el pago de la reserva, desde la solicitud (DR73; decisión del dueño, 2026-11-27). Lo usan la tarjeta del
 * estudiante y el panel de la residencia, cada uno con su server action. Acción secundaria: se despliega al tocarla. Con un caso abierto
 * muestra solo el aviso del plazo frenado. El servidor valida actor, estado y textos.
 */
export function PaymentSupportCaseForm({
  action,
  caseOpen,
  disabled = false,
}: {
  action: (prev: CaseState, formData: FormData) => Promise<CaseState>;
  caseOpen: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (caseOpen || state.status === "saved") {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
        <Icon name="support_agent" className="mt-0.5 shrink-0 text-lg text-forest-700" />
        <span>Hay un caso abierto en Soporte sobre este pago. El plazo queda frenado mientras siga abierto.</span>
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="mt-4 w-full sm:w-auto" disabled={disabled} onClick={() => setOpen(true)}>
        Abrir un caso en Soporte
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-3 rounded-field border border-line-2 bg-sand-50 p-4">
      <Textarea label="Contanos qué pasó con el pago" name="description" rows={4} required minLength={20} maxLength={2000} hint="No pongas datos bancarios." />
      <p className="text-xs text-ink-soft">
        EstuRed es una plataforma intermediaria: puede analizar y actuar en los casos que considere pertinente, pero no garantiza un
        resultado ni interviene en todos los reclamos. {PAYMENT_CASE_EXCEPTION}
      </p>
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          name="terms_accepted"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-forest"
        />
        Leí el alcance de la intervención de EstuRed y quiero continuar.
      </label>
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!termsAccepted || isPending || disabled}>
          {isPending ? "Abriendo…" : "Abrir caso"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
