"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { publishRegulationPdfAction, type PublishRegulationState } from "@/app/residence/[residence_id]/regulation/actions";
import { MAX_REGULATION_PDF_BYTES } from "@/lib/regulations/pdfFile";

const initialState: PublishRegulationState = { status: "idle" };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? "Subiendo…" : "Publicar PDF como versión nueva"}
    </Button>
  );
}

/**
 * Publica el reglamento propio como archivo PDF (DR62 a). Es una versión más: rige apenas se publica y la aceptan quienes envían
 * una solicitud nueva. El servidor valida permiso, tamaño (5 MB) y que sea un PDF de verdad.
 */
export function RegulationPdfUpload({ residenceId, canEdit, currentIsPdf }: { residenceId: string; canEdit: boolean; currentIsPdf: boolean }) {
  const [state, formAction] = useActionState(publishRegulationPdfAction.bind(null, residenceId), initialState);
  const maxMb = MAX_REGULATION_PDF_BYTES / (1024 * 1024);
  return (
    <form action={formAction} className="space-y-3 rounded-card border border-sand-200 bg-sand-50 p-4" aria-label="Subir el reglamento en PDF">
      <div>
        <p className="text-sm font-bold text-ink">¿Ya tenés tu reglamento en PDF?</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Subilo y queda como versión nueva: quienes envían una solicitud lo descargan, lo leen y lo aceptan. Solo PDF, hasta {maxMb} MB.
          {currentIsPdf ? " Hoy rige un PDF: subir otro lo reemplaza para las solicitudes nuevas." : " Reemplaza al texto vigente para las solicitudes nuevas."}
        </p>
      </div>
      <label className="block text-sm font-semibold text-ink">
        <span className="sr-only">Archivo PDF del reglamento</span>
        <input
          type="file"
          name="regulation_pdf"
          accept="application/pdf"
          required
          disabled={!canEdit}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-forest-700"
        />
      </label>
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "published" && (
        <p role="status" className="rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          {state.message}
        </p>
      )}
      <SubmitButton disabled={!canEdit} />
    </form>
  );
}
