"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

const STORAGE_KEY = "estured:premium-notice-dismissed";
const EVENT = "estured:premium-notice";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function readDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Aviso «Función Premium, hoy bonificada» con CTA al comparador de planes (DR17).
 * Se puede cerrar y no vuelve a mostrarse (vale para todas las pantallas premium; queda en este navegador).
 */
export function PremiumNotice({
  residenceId,
  feature,
  className = "",
}: {
  residenceId: string;
  /** Nombre de la función de la pantalla actual, p. ej. «Renovaciones». */
  feature: string;
  className?: string;
}) {
  // En el servidor se asume «cerrado» para no mostrar un destello a quien ya lo descartó.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* sin almacenamiento: se cierra solo hasta recargar */
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div
      role="note"
      className={`flex items-center gap-3 rounded-card border border-line bg-sand-50 py-2 pl-3 pr-2 ${className}`}
    >
      <Icon name="lock" className="shrink-0 text-lg text-ink-faint" aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-ink-soft">
        <span className="font-bold text-ink">Función Premium, hoy bonificada.</span>{" "}
        {feature} es parte de la Gestión Operativa del Plan Premium.
      </p>
      <Link
        href={`/residence/${residenceId}/plan`}
        className="shrink-0 rounded-full bg-forest px-3.5 py-1.5 text-sm font-bold text-white hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        Ver planes
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar y no volver a mostrar"
        title="Cerrar y no volver a mostrar"
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-faint hover:bg-sand-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="close" className="text-lg" aria-hidden />
      </button>
    </div>
  );
}
