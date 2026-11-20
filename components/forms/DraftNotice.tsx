"use client";

import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/forms/localDraft";
import type { LocalDraftNotice } from "@/components/forms/useLocalDraft";

/**
 * Aviso de que se recuperó (o hay) un borrador guardado en este dispositivo. Discreto: se puede cerrar y no roba el foco.
 * `restored`: ya se aplicó al formulario, con «Descartar» para volver a lo guardado en la cuenta.
 * `stale`: el servidor cambió desde que se escribió; se ofrece recuperarlo igual o descartarlo.
 */
export function DraftNotice({
  notice,
  what,
  extra,
  onDiscard,
  onAccept,
  onDismiss,
  className = "",
}: {
  notice: LocalDraftNotice | null;
  /** Qué se recuperó, en minúscula y con artículo: «tus cambios sin guardar», «tu borrador del reglamento». */
  what: string;
  /** Frase final opcional (p. ej. recordar que los archivos hay que volver a elegirlos). */
  extra?: string;
  onDiscard: () => void;
  onAccept: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  if (!notice) return null;
  const time = formatClock(notice.savedAt);
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-field bg-forest-tint px-4 py-3 text-sm text-ink ${className}`}>
      <p className="min-w-0 flex-1">
        {notice.kind === "restored" ? (
          <>
            <strong>Recuperamos {what}</strong> de este dispositivo (guardados a las {time}). Todavía no están en tu cuenta.{extra ? ` ${extra}` : ""}
          </>
        ) : (
          <>
            <strong>Encontramos {what} en este dispositivo</strong> (de las {time}), pero la información guardada cambió desde entonces. ¿Querés
            recuperarlos igual?
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {notice.kind === "stale" && (
          <Button type="button" variant="outline" size="sm" onClick={onAccept}>
            Recuperar
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          Descartar
        </Button>
        {notice.kind === "restored" && (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Entendido
          </Button>
        )}
      </div>
    </div>
  );
}
