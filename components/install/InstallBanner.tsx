"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useInstallState } from "@/components/install/useInstallState";

const KEY = "estured:install-banner-dismissed";

/**
 * Aviso descartable «Instalá la app» para las áreas con sesión (estudiante, familiar, residencia).
 * Solo en celular y solo si la app no está instalada. Descartarlo lo oculta en este navegador.
 */
export function InstallBanner() {
  const { platform, installed } = useInstallState();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || installed || (platform !== "ios" && platform !== "android")) return null;

  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-card border border-line bg-paper p-3 md:hidden">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
        <Icon name="notifications_active" className="text-xl" />
      </span>
      <Link href="/instalar" className="min-w-0 flex-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
        <span className="block font-bold text-ink">Instalá la app</span>
        <span className="block text-ink-soft">Ícono en tu pantalla y avisos de tu solicitud.</span>
      </Link>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            /* sin almacenamiento: el aviso vuelve en la próxima visita */
          }
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Icon name="close" className="text-xl" />
      </button>
    </div>
  );
}
