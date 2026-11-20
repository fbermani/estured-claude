import { formatClock } from "@/lib/forms/localDraft";
import type { LocalDraftState } from "@/components/forms/useLocalDraft";

/**
 * Indicador de guardado, discreto y sin robar el foco (`role="status"`, `aria-live="polite"`). Distingue con claridad lo que quedó
 * en este dispositivo (borrador local) de lo que ya está en la cuenta: nunca dice «Guardado» si solo es un borrador.
 */
export function SaveStatus({
  dirty,
  localState,
  localSavedAt,
  accountSavedAt,
  saving = false,
  accountLabel = "Guardado en tu cuenta",
  className = "",
}: {
  dirty: boolean;
  localState: LocalDraftState;
  localSavedAt: number | null;
  /** Hora del último guardado confirmado por el servidor en esta sesión (null = ninguno todavía). */
  accountSavedAt: number | null;
  saving?: boolean;
  accountLabel?: string;
  className?: string;
}) {
  let text = "";
  let tone: "neutral" | "warn" = "neutral";
  if (saving) {
    text = "Guardando…";
  } else if (dirty && localState === "unavailable") {
    text = "Cambios sin guardar. Este navegador no permite guardar borradores: guardá antes de salir.";
    tone = "warn";
  } else if (dirty && localState === "saved" && localSavedAt !== null) {
    text = `Borrador guardado en este dispositivo a las ${formatClock(localSavedAt)}. Todavía no está en tu cuenta.`;
  } else if (dirty) {
    text = "Cambios sin guardar…";
  } else if (accountSavedAt !== null) {
    text = `${accountLabel} a las ${formatClock(accountSavedAt)}.`;
  }
  return (
    <p role="status" aria-live="polite" className={`text-xs ${tone === "warn" ? "text-warning-fg" : "text-ink-soft"} empty:hidden ${className}`}>
      {text}
    </p>
  );
}
