"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { leavingNavigationTarget } from "@/lib/forms/navigation";

/**
 * Avisa antes de salir de una pantalla con cambios sin guardar.
 * - Intercepta los clics en enlaces internos (también el menú lateral) en fase de captura mientras `active` sea true y muestra un
 *   diálogo con tres salidas: «Guardar y seguir», «Salir sin guardar» y «Seguir editando».
 * - Agrega `beforeunload` (cerrar la pestaña o recargar) solo mientras `active`.
 * - El botón Atrás del navegador no se puede frenar de forma confiable: ese caso lo cubre el borrador local del formulario.
 * - Sin `onSave` el diálogo ofrece solo «Salir» y «Seguir editando».
 */
export function UnsavedChangesGuard({
  active,
  title = "Tenés cambios sin guardar",
  description,
  impactNote,
  saveLabel = "Guardar y seguir",
  leaveLabel = "Salir sin guardar",
  stayLabel = "Seguir editando",
  onSave,
  onLeave,
}: {
  active: boolean;
  title?: string;
  /** Qué pasa con lo escrito si se sale sin guardar. */
  description: string;
  /** Aviso extra sobre el efecto de guardar (p. ej. «queda pendiente de aprobación»). */
  impactNote?: string | null;
  saveLabel?: string;
  leaveLabel?: string;
  stayLabel?: string;
  /** Guarda en el servidor y resuelve `{ ok }`; si `ok`, el guard navega al destino. Un `message` se muestra en el diálogo. */
  onSave?: () => Promise<{ ok: boolean; message?: string }>;
  /** Se llama justo antes de salir sin guardar (p. ej. para volcar el borrador local). */
  onLeave?: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const activeRef = useRef(active);
  const savingRef = useRef(false);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Algunos navegadores todavía exigen returnValue para mostrar el aviso.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!activeRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const next = leavingNavigationTarget(anchor.getAttribute("href") ?? "", window.location.href);
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      setError(null);
      setTarget(next);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  function go(href: string) {
    activeRef.current = false;
    router.push(href);
  }

  async function saveAndLeave() {
    if (!onSave || !target || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await onSave();
      if (result.ok) {
        const href = target;
        setTarget(null);
        go(href);
      } else {
        setError(result.message ?? "No pudimos guardar. Revisá los datos o elegí otra opción.");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function leave() {
    if (!target) return;
    onLeave?.();
    const href = target;
    setTarget(null);
    go(href);
  }

  return (
    <Dialog open={target !== null} onClose={() => (saving ? undefined : setTarget(null))} labelledBy={titleId} describedBy={descId} maxWidthClass="sm:max-w-md">
      <div className="px-5 py-5 sm:px-6">
        <h2 id={titleId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
        {impactNote && <p className="mt-2 rounded-field bg-warning-bg px-3 py-2 text-xs text-warning-fg">{impactNote}</p>}
        {error && (
          <p role="alert" className="mt-3 rounded-field bg-danger-bg px-3 py-2 text-sm font-medium text-danger-fg">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
        <Button type="button" variant="ghost" size="sm" onClick={leave} disabled={saving}>
          {leaveLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setTarget(null)} disabled={saving} data-autofocus>
          {stayLabel}
        </Button>
        {onSave && (
          <Button type="button" size="sm" onClick={saveAndLeave} disabled={saving}>
            {saving ? "Guardando…" : saveLabel}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
