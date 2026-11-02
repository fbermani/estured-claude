"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

/**
 * Rotación suave de fotos (DR18, tanda 2). Avanza sola cada `intervalMs`, salvo que:
 * el usuario pidió menos movimiento (`prefers-reduced-motion`), la pestaña esté oculta, el bloque no se vea en pantalla,
 * o `paused` sea true (hover / foco dentro del carrusel). Con una sola foto no hace nada.
 * `playing`/`toggle` alimentan el botón pausa/play (el botón manda; hover/foco solo pausan temporalmente).
 * Devuelve el índice, los controles manuales y la `ref` que hay que poner en el contenedor.
 */
export function useRotation(count: number, { intervalMs = 4500, paused = false }: { intervalMs?: number; paused?: boolean } = {}) {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // El botón de pausa/play manda (WCAG 2.2.2): null = sin decisión del usuario → arranca pausado solo con reduced-motion.
  const [manual, setManual] = useState<boolean | null>(null);
  const playing = manual ?? !reducedMotion;
  const toggle = useCallback(() => setManual(!playing), [playing]);

  const active = count > 1 && playing && !paused && visible && tabVisible;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [active, count, intervalMs]);

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % Math.max(count, 1)), [count]);
  const safeIndex = count > 0 ? index % count : 0;
  return { index: safeIndex, go, setIndex, ref, playing, toggle };
}

/**
 * Deslizar para cambiar de foto (táctil/lápiz). Poner `touch-pan-y` en el contenedor para no romper el scroll vertical.
 * Devuelve los handlers a esparcir en el contenedor; tras un deslizamiento anula el click siguiente (no abre la ficha por error).
 */
export function useSwipe(onSwipe: (delta: 1 | -1) => void, { threshold = 40 }: { threshold?: number } = {}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY };
      swiped.current = false;
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      swiped.current = true;
      window.setTimeout(() => {
        swiped.current = false;
      }, 300);
      onSwipe(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => {
      start.current = null;
    },
    onClickCapture: (e: MouseEvent) => {
      if (!swiped.current) return;
      swiped.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
