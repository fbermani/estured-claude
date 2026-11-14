"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { formatDate as formatTimestampDate } from "@/lib/dates/format";
import { requestResidenceDocumentAccess } from "@/lib/documents/requestResidenceDocumentAccess";

export type StudentDocumentItem = {
  label: string;
  delivered: boolean;
  deliveredAt: string | null;
  /** Solo viene cuando quien mira puede abrirlo (DR48); si no, se muestra únicamente el estado. */
  fileId: string | null;
};

/**
 * DR48: lista de la documentación que pide la residencia con su estado. «Entregado» pasa a ser «Ver» cuando la persona puede
 * abrirlo: el servidor vuelve a autorizar, registra la apertura y devuelve un link firmado de 5 minutos.
 */
export function StudentDocumentChecklist({ residenceId, items }: { residenceId: string; items: StudentDocumentItem[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => (
        <li key={d.label} className="flex flex-wrap items-center justify-between gap-2 rounded-field bg-cream-2 px-3 py-2 text-sm">
          <span className="min-w-0 truncate font-medium text-ink">{d.label}</span>
          {d.delivered ? (
            d.fileId ? (
              <OpenDocumentButton residenceId={residenceId} fileId={d.fileId} label={d.label} deliveredAt={d.deliveredAt} />
            ) : (
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-forest-700">
                <Icon name="check_circle" className="text-base" /> Entregado{d.deliveredAt ? ` · ${formatTimestampDate(d.deliveredAt)}` : ""}
              </span>
            )
          ) : (
            <Badge tone="amber">Falta</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function OpenDocumentButton({
  residenceId,
  fileId,
  label,
  deliveredAt,
}: {
  residenceId: string;
  fileId: string;
  label: string;
  deliveredAt: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setPending(true);
    setError(null);
    // La pestaña se abre en el mismo clic (si no, el navegador la bloquea) y se completa cuando llega el link.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await requestResidenceDocumentAccess(residenceId, fileId);
      if (result.ok) {
        if (tab) tab.location.href = result.url;
        else window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        tab?.close();
        setError(result.error);
      }
    } catch {
      tab?.close();
      setError("No pudimos abrir el documento. Probá de nuevo en un rato.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="flex items-center gap-2">
        {deliveredAt && <span className="text-xs tabular-nums text-ink-faint">{formatTimestampDate(deliveredAt)}</span>}
        <button
          type="button"
          onClick={open}
          disabled={pending}
          aria-label={`Ver ${label} (se abre en una pestaña nueva)`}
          className="inline-flex items-center gap-1 rounded-field px-1.5 py-0.5 text-xs font-semibold text-forest-700 underline underline-offset-2 hover:text-forest-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50"
        >
          <Icon name="open_in_new" className="text-sm" />
          {pending ? "Abriendo…" : "Ver"}
        </button>
      </span>
      {error && (
        <span role="alert" className="max-w-56 text-right text-xs font-medium text-danger-fg">
          {error}
        </span>
      )}
    </span>
  );
}
