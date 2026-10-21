"use client";

import { formatDate } from "@/lib/dates/format";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { uploadStudentDocument, type UploadDocumentState } from "@/app/students/profile/actions";

const initialState: UploadDocumentState = { status: "idle" };

const action = uploadStudentDocument.bind(null, "other");

/**
 * "Otros documentos importantes" (Ciclo 37) — a diferencia de
 * `DocumentUpload.tsx` (un slot fijo que se oculta al subir), esta
 * lista acepta múltiples archivos: certificados, visa, seguro médico,
 * carta de aceptación, etc. que puntualmente pida una residencia. El
 * formulario de subida sigue visible después de cada envío exitoso.
 */
export function OtherDocumentsUpload({ files }: { files: { id: string; filename: string; createdAt: string }[] }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="rounded-field border border-line p-3">
      <p className="text-sm font-medium text-ink">Otros documentos importantes</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        Algunas residencias piden documentación adicional: certificados, visa, seguro médico, carta de aceptación.
      </p>

      {files.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-field bg-cream-2 px-2.5 py-1.5 text-xs text-ink-soft">
              <Icon name="description" className="shrink-0 text-sm text-forest-700" />
              <span className="min-w-0 flex-1 truncate">{f.filename}</span>
              <span className="shrink-0 text-ink-faint">
                {formatDate(f.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          name="file"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="block text-xs text-ink-soft file:mr-3 file:rounded-field file:border-0 file:bg-forest-tint file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-forest-700"
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Subiendo…" : "Agregar documento"}
        </Button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">
          {state.message}
        </p>
      )}
    </div>
  );
}
