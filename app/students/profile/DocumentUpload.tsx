"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { uploadStudentDocument, type UploadDocumentState } from "@/app/students/profile/actions";

const initialState: UploadDocumentState = { status: "idle" };

export function DocumentUpload({
  documentType,
  label,
  done,
  requirementLabel,
}: {
  documentType: "student_identity" | "student_academic_proof" | "other";
  label: string;
  done: boolean;
  /** DR38: con `other`, el nombre del documento «Otro» que pide la residencia (se guarda para reconocerlo después). */
  requirementLabel?: string;
}) {
  const action = uploadStudentDocument.bind(null, documentType);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const uploaded = done || state.status === "saved";

  return (
    <div className="rounded-field border border-line p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        {uploaded && (
          <span className="flex items-center gap-1 text-xs font-semibold text-forest-700">
            <Icon name="check_circle" className="text-base" /> Subido
          </span>
        )}
      </div>
      {!uploaded && (
        <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
          {requirementLabel && <input type="hidden" name="requirement_label" value={requirementLabel} />}
          <input
            name="file"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="block text-xs text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-forest-700"
          />
          <Button type="submit" variant="outline" size="sm" disabled={isPending}>
            {isPending ? "Subiendo…" : "Subir"}
          </Button>
        </form>
      )}
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </div>
  );
}
