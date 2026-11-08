"use client";

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { notifyWaitlistBatchAction } from "@/app/residence/[residence_id]/waitlist/actions";
import { MAX_NOTIFY_BATCH } from "@/lib/waitlist-entries/board";
import { Icon } from "@/components/ui/Icon";

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  disabled: boolean;
};

const SelectionContext = createContext<Ctx | null>(null);

function useSelection(): Ctx {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("WaitlistSelection fuera de su proveedor");
  return ctx;
}

/**
 * Selección múltiple de la lista de espera (DR41): el tablero lo arma el servidor; acá vive solo el estado de la selección y la barra
 * de acción «Avisar a N». Sin permiso `waitlist.manage` las casillas quedan deshabilitadas (solo presentación: el servidor valida).
 */
export function WaitlistSelectionProvider({
  residenceId,
  canManage,
  children,
}: {
  residenceId: string;
  canManage: boolean;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const ctx = useMemo<Ctx>(
    () => ({
      selected,
      disabled: !canManage,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      setMany: (ids, on) =>
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (on) next.add(id);
            else next.delete(id);
          }
          return next;
        }),
    }),
    [selected, canManage],
  );

  const count = selected.size;
  const overLimit = count > MAX_NOTIFY_BATCH;

  function send() {
    setFeedback(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await notifyWaitlistBatchAction(residenceId, ids);
      setFeedback({ tone: result.status === "saved" ? "ok" : "error", text: result.message ?? "Listo." });
      // Los avisados salen de «En espera»: se limpia la selección (los que fallaron se vuelven a elegir a mano).
      if (result.status === "saved") setSelected(new Set());
    });
  }

  return (
    <SelectionContext.Provider value={ctx}>
      {children}
      {(count > 0 || feedback) && (
        <div
          role="region"
          aria-label="Acciones de la selección"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper px-4 py-3 shadow-float sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[min(40rem,calc(100%-3rem))] sm:-translate-x-1/2 sm:rounded-card sm:border"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {feedback && (
            <p
              role={feedback.tone === "error" ? "alert" : "status"}
              className={`mb-2 text-sm font-medium ${feedback.tone === "error" ? "text-danger-fg" : "text-forest-700"}`}
            >
              {feedback.text}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {count > 0 ? `${count} ${count === 1 ? "elegida" : "elegidas"}` : "Sin selección"}
              {overLimit && <span className="ml-2 text-xs font-medium text-danger-fg">Máximo {MAX_NOTIFY_BATCH} por vez</span>}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                  setFeedback(null);
                }}
                className="min-h-11 rounded-full px-4 text-sm font-semibold text-ink-soft hover:bg-cream-2"
              >
                {count > 0 ? "Limpiar" : "Cerrar"}
              </button>
              {count > 0 && (
                <button
                  type="button"
                  onClick={send}
                  disabled={pending || overLimit}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-bold text-white hover:bg-forest-700 disabled:opacity-50"
                >
                  <Icon name="campaign" className="text-lg" />
                  {pending ? "Avisando…" : `Avisar a ${count}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </SelectionContext.Provider>
  );
}

/** Casilla de una fila (área táctil de 44 px). */
export function EntryCheckbox({ entryId, label }: { entryId: string; label: string }) {
  const { selected, toggle, disabled } = useSelection();
  return (
    <label className="-m-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={selected.has(entryId)}
        onChange={() => toggle(entryId)}
        disabled={disabled}
        aria-label={`Elegir a ${label}`}
        className="h-5 w-5 accent-forest disabled:cursor-not-allowed"
      />
    </label>
  );
}

/** «Elegir todos» del tipo de habitación (solo las avisables de esa columna). */
export function SelectGroupToggle({ entryIds, groupName }: { entryIds: string[]; groupName: string }) {
  const { selected, setMany, disabled } = useSelection();
  if (entryIds.length === 0) return null;
  const allOn = entryIds.every((id) => selected.has(id));
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setMany(entryIds, !allOn)}
      aria-pressed={allOn}
      aria-label={`${allOn ? "Quitar" : "Elegir"} todos los de ${groupName}`}
      className="min-h-11 rounded-full px-3 text-xs font-bold text-forest-700 hover:bg-forest-tint disabled:cursor-not-allowed disabled:opacity-50"
    >
      {allOn ? "Quitar todos" : "Elegir todos"}
    </button>
  );
}
