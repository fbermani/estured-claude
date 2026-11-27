"use client";

import { useState } from "react";
import { cmd } from "@/components/admin/ui/tokens";
import { requestDocumentAccess } from "@/lib/documents/requestDocumentAccess";
import { Textarea } from "@/components/ui/Input";

/**
 * Botón de "ver documento" con justificación obligatoria (docs/09
 * §18.2) — reemplaza los links directos a signed URL que antes se
 * generaban server-side sin ningún gate. Reutilizado en
 * payments/verifications/support-cases/profile-edits/documents.
 */
export function DocumentAccessButton({ fileId, label = "Ver documento" }: { fileId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-bold underline"
        style={{ color: cmd.primary }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="mt-1 rounded p-2" style={{ border: `1px solid ${cmd.border}`, backgroundColor: cmd.surfaceContainer }}>
      <Textarea
        label="Motivo del acceso"
        hint="Obligatorio, mínimo 10 caracteres."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Ej: verificando comprobante para validar pago reportado."
      />
      {error && (
        <p className="mt-1 text-xs font-medium" style={{ color: cmd.rose }}>
          {error}
        </p>
      )}
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await requestDocumentAccess(fileId, reason);
            setPending(false);
            if (result.ok) {
              window.open(result.url, "_blank", "noopener,noreferrer");
              setOpen(false);
              setReason("");
            } else {
              setError(result.error);
            }
          }}
          className="rounded px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: cmd.primary }}
        >
          {pending ? "Verificando…" : "Confirmar y ver"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setReason("");
          }}
          className="text-xs font-semibold"
          style={{ color: cmd.outline }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
