"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { openStudentSupportCase, type OpenCaseState } from "@/app/students/support/actions";

const initialState: OpenCaseState = { status: "idle" };

export function OpenCaseForm({ residences }: { residences: { id: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(openStudentSupportCase, initialState);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (state.status === "saved") {
    return (
      <div className="rounded-card border-[1.5px] border-line bg-forest-tint p-6 text-sm font-medium text-forest-700">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-card border-[1.5px] border-line bg-paper p-6">
      <Select label="¿Sobre qué residencia?" name="residence_id" required defaultValue="">
        <option value="" disabled>
          Elegí una residencia
        </option>
        {residences.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>

      <Textarea label="Contanos qué pasó" name="description" rows={5} required minLength={20} />

      <div>
        <label className="text-sm font-medium text-ink" htmlFor="evidence">
          Evidencia (opcional): fotos, capturas, video o audio
        </label>
        <input
          id="evidence"
          name="evidence"
          type="file"
          multiple
          accept="application/pdf,image/*,video/mp4,video/quicktime,audio/*"
          className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-forest-700"
        />
      </div>

      <div className="rounded-field bg-cream-2 p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Antes de continuar</p>
        <p className="mt-1">
          EstuRed es una plataforma intermediaria: puede analizar y actuar en los casos que considere pertinente,
          pero no garantiza un resultado ni interviene en todos los reclamos. Abrir un caso no suspende
          automáticamente tu solicitud, reserva o renovación.
        </p>
      </div>

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

      <Button type="submit" disabled={!termsAccepted || isPending}>
        {isPending ? "Enviando…" : "Abrir caso"}
      </Button>
    </form>
  );
}
