"use client";

import { useEffect, useRef, useState } from "react";
import { TILE_SIZE, type PositionedTile } from "@/lib/maps/osmTiles";

/**
 * Capa de teselas del mapa de la ficha (cliente solo para detectar fallas de carga). Posiciona cada tesela
 * respecto del centro del mapa. Si fallan la mitad o más de las teselas pedidas (sin red, bloqueo, el proveedor
 * caído), se muestra un aviso sobre el fondo liso: la dirección y las distancias siguen disponibles en texto.
 */
export function MapTiles({ tiles, unavailableMessage = "El mapa no está disponible; la dirección está arriba." }: { tiles: PositionedTile[]; unavailableMessage?: string }) {
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const markFailed = (key: string) => setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  // Imágenes que fallaron antes de hidratar: no vuelven a disparar `onError`.
  useEffect(() => {
    containerRef.current?.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && img.dataset.key) markFailed(img.dataset.key);
    });
  }, []);

  const unavailable = failed.size >= Math.max(1, Math.ceil(tiles.length / 2));

  return (
    <>
      <div ref={containerRef} className="absolute left-1/2 top-1/2 h-0 w-0" aria-hidden="true">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element -- teselas externas de OSM: next/image no aporta
          <img
            key={t.key}
            data-key={t.key}
            src={t.url}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => markFailed(t.key)}
            className="pointer-events-none absolute max-w-none select-none [filter:saturate(.55)_sepia(.12)]"
            style={{ left: t.dx, top: t.dy, width: TILE_SIZE, height: TILE_SIZE }}
          />
        ))}
      </div>
      {unavailable && (
        <p
          role="status"
          className="absolute inset-x-3 top-3 z-20 rounded-field bg-paper/95 px-3 py-2 text-center text-xs font-semibold text-ink-soft shadow-card"
        >
          {unavailableMessage}
        </p>
      )}
    </>
  );
}
