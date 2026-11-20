"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useInstallState } from "@/components/install/useInstallState";

type Step = { icon: string; title: string; detail: string };

const STEPS: Record<"ios" | "android", { browser: string; steps: Step[]; note: string }> = {
  ios: {
    browser: "Safari",
    steps: [
      { icon: "language", title: "Abrí EstuRed en Safari", detail: "Entrá a estured.vercel.app desde Safari, el navegador azul con la brújula." },
      { icon: "ios_share", title: "Tocá «Compartir»", detail: "Es el cuadrado con una flecha hacia arriba, abajo en el centro de la pantalla." },
      { icon: "add_box", title: "Elegí «Agregar a pantalla de inicio»", detail: "Deslizá el menú hacia arriba hasta encontrarlo." },
      { icon: "check_circle", title: "Tocá «Agregar»", detail: "El ícono de EstuRed aparece en tu pantalla de inicio, junto a tus otras apps." },
    ],
    note: "Los avisos en iPhone funcionan solo si instalás la app, y requieren iOS 16.4 o más nuevo. Abrí EstuRed siempre desde su ícono.",
  },
  android: {
    browser: "Chrome",
    steps: [
      { icon: "language", title: "Abrí EstuRed en Chrome", detail: "Entrá a estured.vercel.app desde Chrome." },
      { icon: "more_vert", title: "Tocá el menú ⋮", detail: "Son los tres puntos, arriba a la derecha." },
      { icon: "install_mobile", title: "Elegí «Instalar app»", detail: "En algunos celulares dice «Agregar a la pantalla principal»." },
      { icon: "check_circle", title: "Confirmá con «Instalar»", detail: "El ícono de EstuRed aparece en tu pantalla principal o en tus apps." },
    ],
    note: "Si no ves «Instalar app», actualizá Chrome o abrí esta página desde Chrome (no desde el navegador de otra app).",
  },
};

const BENEFITS = [
  { icon: "home", title: "Ícono en tu pantalla principal", text: "Abrís EstuRed con un toque, como cualquier otra app." },
  { icon: "notifications_active", title: "Avisos de tu solicitud", text: "Te avisamos, por ejemplo, cuando una residencia aprueba tu solicitud." },
  { icon: "fullscreen", title: "Pantalla completa", text: "Sin barra del navegador: más espacio para ver las residencias." },
  { icon: "bolt", title: "Más rápida de abrir", text: "Entrás directo a tu panel, sin buscar el enlace otra vez." },
];

const tabBase =
  "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function InstallGuide() {
  const { platform, installed, promptEvent } = useInstallState();
  const [chosen, setChosen] = useState<"ios" | "android" | null>(null);
  const active: "ios" | "android" = chosen ?? (platform === "ios" ? "ios" : "android");
  const data = STEPS[active];

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold text-ink sm:text-4xl">Instalá la app de EstuRed</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-soft sm:text-lg">
        Tené EstuRed en tu pantalla principal y enterate al instante cuando una residencia responde tu solicitud. Es gratis y no ocupa espacio.
      </p>

      {installed && (
        <p role="status" className="mt-6 flex items-center gap-2 rounded-card bg-forest-tint px-4 py-3 text-sm font-bold text-forest-700">
          <Icon name="check_circle" className="text-xl" />
          Ya tenés la app instalada en este dispositivo.
        </p>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3 rounded-card border border-line bg-paper p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
              <Icon name={b.icon} className="text-xl" />
            </span>
            <div>
              <p className="text-base font-bold text-ink">{b.title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{b.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-bold text-ink">Cómo instalarla</h2>

      <div role="tablist" aria-label="Tu celular" className="mt-4 flex gap-1 rounded-full bg-cream-2 p-1">
        {(["android", "ios"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            id={`tab-${p}`}
            aria-selected={active === p}
            aria-controls={`panel-${p}`}
            onClick={() => setChosen(p)}
            className={`${tabBase} ${active === p ? "bg-paper text-forest-700 shadow-sm" : "text-ink-soft hover:text-ink"}`}
          >
            <Icon name={p === "ios" ? "phone_iphone" : "phone_android"} className="text-xl" />
            {p === "ios" ? "iPhone" : "Android"}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} className="mt-6">
        {active === "android" && promptEvent && !installed && (
          <div className="mb-6 rounded-card border border-line bg-paper p-4">
            <p className="text-base font-bold text-ink">Tu celular permite instalarla ahora</p>
            <Button type="button" onClick={install} className="mt-3">
              <Icon name="install_mobile" className="text-xl" />
              Instalar EstuRed
            </Button>
          </div>
        )}
        <ol className="space-y-3">
          {data.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-card border border-line bg-paper p-4">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold tabular-nums text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-bold text-ink">
                  <Icon name={s.icon} className="text-xl text-forest-700" />
                  {s.title}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
          <Icon name="info" className="mt-0.5 text-lg" />
          {data.note}
        </p>
      </div>

      {platform === "other" && (
        <p className="mt-6 text-sm text-ink-soft">
          Estás en una computadora: abrí esta página desde tu celular para instalar la app ({data.browser === "Safari" ? "iPhone" : "Android"} o el otro sistema).
        </p>
      )}
    </div>
  );
}
