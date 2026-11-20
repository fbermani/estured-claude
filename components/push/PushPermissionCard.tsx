"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useInstallState } from "@/components/install/useInstallState";
import { getPushState } from "@/lib/push/actions";
import { currentEndpoint, enablePush, pushSupported } from "@/lib/push/client";

const SNOOZE_KEY = "estured:push-card-snooze:v1";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

const BENEFIT: Record<"student" | "residence" | "admin", string> = {
  student: "Enterate al instante cuando una residencia responde tu solicitud.",
  residence: "Enterate cuando llega una solicitud nueva.",
  admin: "Enterate de lo que necesita revisión.",
};

type Mode = "checking" | "hidden" | "enable" | "ios-install" | "done";

function isSnoozed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/**
 * Tarjeta propia de EstuRed para ofrecer los avisos (DR61). Nunca pide el permiso del navegador al montar:
 * solo `enablePush()` tras el clic en «Activar avisos». «Ahora no» la silencia 14 días en este navegador.
 */
export function PushPermissionCard({ audience }: { audience: "student" | "residence" | "admin" }) {
  const { platform, installed } = useInstallState();
  const [mode, setMode] = useState<Mode>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (platform === null) return;
    let cancelled = false;
    (async () => {
      if (isSnoozed()) return setMode("hidden");
      const iosWithoutApp = platform === "ios" && !installed;
      if (!iosWithoutApp) {
        if (!pushSupported() || Notification.permission === "denied") return setMode("hidden");
      }
      let state;
      try {
        const endpoint = iosWithoutApp ? null : await currentEndpoint();
        state = await getPushState(endpoint);
      } catch {
        return setMode("hidden");
      }
      if (cancelled) return;
      if (!state.available || state.subscribed) return setMode("hidden");
      setMode(iosWithoutApp ? "ios-install" : "enable");
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, installed]);

  const snooze = useCallback(() => {
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* sin almacenamiento: la tarjeta vuelve en la próxima visita */
    }
    setMode("hidden");
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush();
      if (result.ok) {
        setMode("done");
      } else {
        setError(result.error);
        if (typeof Notification !== "undefined" && Notification.permission === "denied") setMode("hidden");
      }
    } catch {
      setError("No pudimos activar los avisos. Probá de nuevo en un rato.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "checking" || mode === "hidden") return null;

  if (mode === "done") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-card border-[1.5px] border-line bg-mint p-4 text-sm font-semibold text-forest-700">
        <Icon name="check_circle" className="text-xl" />
        Listo, activamos los avisos en este dispositivo.
      </div>
    );
  }

  return (
    <section aria-label="Avisos" className="flex flex-col gap-4 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
          <Icon name="notifications_active" className="text-2xl" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-ink">Activá los avisos</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{BENEFIT[audience]}</p>
          {mode === "ios-install" && (
            <Link
              href="/instalar"
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-forest-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              En iPhone los avisos funcionan con la app instalada
              <Icon name="arrow_forward" className="text-base" />
            </Link>
          )}
          {error && (
            <p role="alert" className="mt-1 text-sm font-semibold text-danger-fg">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {mode === "enable" && (
          <Button type="button" size="sm" onClick={handleEnable} disabled={busy} aria-busy={busy}>
            {busy ? "Activando…" : "Activar avisos"}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={snooze} disabled={busy}>
          Ahora no
        </Button>
      </div>
    </section>
  );
}
