"use client";

import { useEffect, useRef } from "react";

/**
 * Barra fina de progreso de lectura, pegada bajo la navbar. Solo `transform`, sin transiciones (no hay
 * movimiento decorativo, solo refleja el scroll), así que respeta prefers-reduced-motion por construcción.
 */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.getElementById(targetId);
      if (!el || !bar.current) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const done = Math.min(1, Math.max(0, total <= 0 ? 0 : -rect.top / total));
      bar.current.style.transform = `scaleX(${done})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetId]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-16 z-30 h-[3px] bg-transparent">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-forest will-change-transform" />
    </div>
  );
}
