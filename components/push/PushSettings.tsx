"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { getPushState, setPushPreference, type PushState } from "@/lib/push/actions";
import { currentEndpoint, disablePush, enablePush, pushSupported } from "@/lib/push/client";
import { PUSH_CATEGORY_LABELS, type PushCategory } from "@/lib/notifications/categories";

function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50"
    >
      <span className={`relative h-7 w-12 rounded-full border-[1.5px] transition-colors ${checked ? "border-forest bg-forest" : "border-line-2 bg-cream-2"}`}>
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-paper shadow-sm transition-transform motion-reduce:transition-none ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
    </button>
  );
}

/** Panel de ajustes de avisos push (DR61): este dispositivo + una categoría por interruptor. */
export function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyDevice, setBusyDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = pushSupported();
      setSupported(ok);
      try {
        const endpoint = ok ? await currentEndpoint() : null;
        const next = await getPushState(endpoint);
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadFailed) {
    return (
      <EmptyState
        variant="error"
        icon="notifications_off"
        title="No pudimos cargar tus avisos"
        description="Probá de nuevo en un rato."
      />
    );
  }

  if (state === null || supported === null) {
    return (
      <Card className="p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-cream-2 motion-reduce:animate-none" />
        <div className="mt-4 h-11 w-full animate-pulse rounded bg-cream-2 motion-reduce:animate-none" />
      </Card>
    );
  }

  if (!supported || !state.available) {
    return (
      <EmptyState
        icon="notifications_off"
        title="Los avisos no están disponibles"
        description={
          supported
            ? "Todavía no podemos enviarte avisos. Vas a seguir viendo todo en la campana de la app."
            : "Este navegador no permite avisos. En iPhone funcionan con la app instalada. Mientras tanto, vas a ver todo en la campana de la app."
        }
      />
    );
  }

  async function toggleDevice(next: boolean) {
    setBusyDevice(true);
    setError(null);
    try {
      const result = next ? await enablePush() : await disablePush();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const endpoint = await currentEndpoint();
      setState(await getPushState(endpoint));
    } catch {
      setError("No pudimos cambiar los avisos. Probá de nuevo en un rato.");
    } finally {
      setBusyDevice(false);
    }
  }

  async function toggleCategory(category: PushCategory, next: boolean) {
    setError(null);
    const previous = state;
    setState((s) => (s ? { ...s, categories: s.categories.map((c) => (c.category === category ? { ...c, enabled: next } : c)) } : s));
    try {
      const result = await setPushPreference(category, next);
      if (!result.ok) throw new Error(result.error);
    } catch (e) {
      setState(previous);
      setError(e instanceof Error && e.message ? e.message : "No pudimos guardar el cambio. Probá de nuevo.");
    }
  }

  const devicesLabel =
    state.activeDevices === 0 ? "Ningún dispositivo activo" : state.activeDevices === 1 ? "1 dispositivo activo" : `${state.activeDevices} dispositivos activos`;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Icon name="notifications_active" className="text-xl text-forest-700" />
        <h2 className="font-bold text-ink">Avisos</h2>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id="push-device-label" className="text-sm font-semibold text-ink">
            Avisos en este dispositivo
          </p>
          <p id="push-device-hint" className="text-sm tabular-nums text-ink-soft">
            {devicesLabel}
          </p>
        </div>
        <Switch checked={state.subscribed} onChange={toggleDevice} labelledBy="push-device-label" describedBy="push-device-hint" disabled={busyDevice} />
      </div>

      {state.categories.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {state.categories.map(({ category, enabled }) => {
            const copy = PUSH_CATEGORY_LABELS[category];
            return (
              <li key={category} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p id={`push-cat-${category}`} className="text-sm font-semibold text-ink">
                    {copy.label}
                  </p>
                  <p id={`push-cat-${category}-hint`} className="text-sm text-ink-soft">
                    {copy.hint}
                  </p>
                </div>
                <Switch checked={enabled} onChange={(next) => toggleCategory(category, next)} labelledBy={`push-cat-${category}`} describedBy={`push-cat-${category}-hint`} />
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger-fg">
          {error}
        </p>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
        <Icon name="lock" className="mt-px shrink-0 text-sm text-forest-700" />
        <span>Los avisos no muestran datos personales: el detalle está en la app.</span>
      </p>
      <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
        <Icon name="schedule" className="mt-px shrink-0 text-sm text-forest-700" />
        <span>No enviamos avisos antes de las 9:00 (hora de Argentina).</span>
      </p>
    </Card>
  );
}
