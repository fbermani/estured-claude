"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Confirmación propia (reemplaza `window.confirm`): título, una frase y dos acciones.
 * El foco inicial va a la acción segura (cancelar). `tone="danger"` pinta la confirmación en rojo.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  return (
    <Dialog open={open} onClose={onCancel} labelledBy={titleId} describedBy={description ? descId : undefined} maxWidthClass="sm:max-w-md">
      <div className="px-5 py-5 sm:px-6">
        <h2 id={titleId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-2 text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} data-autofocus>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onConfirm}
          className={tone === "danger" ? "bg-red-700! hover:bg-red-600! hover:shadow-none!" : ""}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
