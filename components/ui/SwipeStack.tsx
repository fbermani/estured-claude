"use client";

import { Children, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Mazo de tarjetas con swipe para mobile (< md). En desktop no cambia nada: los hijos quedan en la grilla de
 * `className`. En mobile todos los hijos se apilan en la misma celda de la grilla (así el mazo toma el alto de la
 * tarjeta más alta sin medir nada en JS) y la que pasa se va al fondo. Los hijos deben ser tarjetas de borde propio.
 * Sin JS (o antes de hidratar) las tarjetas quedan superpuestas con la primera arriba; los controles aparecen al hidratar.
 */
export function SwipeStack({ children, className = "", label = "tarjetas" }: { children: ReactNode; className?: string; label?: string }) {
  const cards = Children.toArray(children);
  const n = cards.length;
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [leaving, setLeaving] = useState<1 | -1 | null>(null);
  const [drag, setDrag] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const x0 = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function advance(dir: 1 | -1) {
    if (busy.current || n < 2) return;
    busy.current = true;
    if (dir === 1) {
      setLeaving(1);
      window.setTimeout(() => {
        setOrder((o) => [...o.slice(1), o[0]]);
        setLeaving(null);
        setDrag(0);
        busy.current = false;
      }, 280);
    } else {
      setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
      setDrag(0);
      window.setTimeout(() => {
        busy.current = false;
      }, 280);
    }
  }

  function onUp() {
    if (x0.current === null) return;
    x0.current = null;
    if (Math.abs(drag) > 70) {
      const dir: 1 | -1 = drag < 0 ? 1 : -1;
      // Se va hacia donde la empujaste.
      if (dir === 1) {
        setLeaving(1);
        busy.current = true;
        window.setTimeout(() => {
          setOrder((o) => [...o.slice(1), o[0]]);
          setLeaving(null);
          setDrag(0);
          busy.current = false;
        }, 280);
      } else advance(-1);
    } else setDrag(0);
  }

  const posOf = (idx: number) => order.indexOf(idx);

  return (
    <div className="md:contents">
      <div
        className={`${className} max-md:grid max-md:grid-cols-1 max-md:pb-10 max-md:[touch-action:pan-y] max-md:[&>*]:[grid-area:1/1]`}
        role="group"
        aria-roledescription="mazo de tarjetas"
        aria-label={label}
        onPointerDown={(e) => {
          if (!narrow || busy.current) return;
          x0.current = e.clientX;
          setDrag(0);
        }}
        onPointerMove={(e) => {
          if (x0.current === null) return;
          setDrag(e.clientX - x0.current);
        }}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {cards.map((card, idx) => {
          const k = posOf(idx);
          const top = k === 0;
          const depth = Math.min(k, 3);
          let t = `translateY(${depth * 12}px) scale(${1 - depth * 0.045})`;
          let o = k > 2 ? 0 : 1;
          if (top && leaving === 1) {
            t = "translateX(-120%) rotate(-10deg)";
            o = 0;
          } else if (top && drag) {
            t = `translateX(${drag}px) rotate(${drag / 22}deg)`;
          }
          const style = { "--t": t, "--o": o, "--z": n - k } as CSSProperties;
          return (
            <div
              key={idx}
              style={style}
              inert={narrow && !top}
              aria-hidden={narrow && !top ? true : undefined}
              className={`md:contents max-md:flex max-md:[&>*]:min-w-0 max-md:[&>*]:flex-1 max-md:[transform:var(--t)] max-md:[opacity:var(--o)] max-md:[z-index:var(--z)] max-md:origin-bottom ${
                drag && top ? "" : "max-md:transition-[transform,opacity] max-md:duration-300 max-md:ease-out-fresh"
              }`}
            >
              {card}
            </div>
          );
        })}
      </div>
      {narrow && n > 1 && (
        <div className="flex items-center justify-between gap-2 md:hidden">
          <button
            type="button"
            aria-label="Tarjeta anterior"
            onClick={() => advance(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-paper text-forest-700 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-forest"
          >
            <Icon name="arrow_back" />
          </button>
          <span className="text-center text-[13px] text-ink-faint" aria-live="polite">
            {order[0] + 1} de {n} · deslizá para ver más
          </span>
          <button
            type="button"
            aria-label="Tarjeta siguiente"
            onClick={() => advance(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-paper text-forest-700 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-forest"
          >
            <Icon name="arrow_forward" />
          </button>
        </div>
      )}
    </div>
  );
}
