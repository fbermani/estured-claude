"use client";

import { Icon } from "@/components/ui/Icon";

/** Botón pausa/play de un carrusel automático (WCAG 2.2.2). Área táctil de 44px. */
export function RotationToggle({
  playing,
  onToggle,
  className = "",
}: {
  playing: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "Pausar carrusel de fotos" : "Reproducir carrusel de fotos"}
      className={`flex size-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${className}`}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-forest-ink/55 text-white">
        <Icon name={playing ? "pause" : "play_arrow"} className="text-base" />
      </span>
    </button>
  );
}
