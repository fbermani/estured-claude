"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { saveIdentityDocument, type IdentityDocumentState } from "@/app/students/profile/actions";
import { IDENTITY_DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPE_LABELS } from "@/lib/students/identityDocument";

const initialState: IdentityDocumentState = { status: "idle" };

/** DR58: tipo y número del documento. Si ya hay uno, se muestra enmascarado (los últimos 3). */
export function IdentityDocumentForm({ savedType, savedMasked }: { savedType: string; savedMasked: string }) {
  const [state, formAction, isPending] = useActionState(saveIdentityDocument, initialState);
  return (
    <form action={formAction} className="rounded-field border border-line p-3">
      <span className="text-sm font-medium text-ink">Número de documento</span>
      {savedMasked && (
        <p className="mt-1 text-xs text-ink-faint">
          Guardado: {IDENTITY_DOCUMENT_TYPE_LABELS[savedType as keyof typeof IDENTITY_DOCUMENT_TYPE_LABELS] ?? savedType} {savedMasked}
        </p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Select label="Tipo" name="document_type" defaultValue={savedType || "dni"} required>
          {IDENTITY_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {IDENTITY_DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Input label="Número" name="document_number" required maxLength={24} autoComplete="off" inputMode="text" />
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <p className="mt-2 text-xs font-semibold text-forest-700">Guardado.</p>}
      <Button type="submit" size="sm" className="mt-2" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
