"use client";

import { getImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";

type Step = { title: string; description: string; img: string; imgMobile: string; alt: string };

const DUR = 7000;

/** Props optimizadas (srcSet/src) de next/image para usarlas dentro de <picture>. */
function shotProps(src: string, sizes: string) {
  return getImageProps({ src, alt: "", width: 780, height: 650, sizes }).props;
}

/** Posición de cada tarjeta en el mazo (desktop): 0 = frente. */
const DECK: Record<number, { t: string; o: number; z: number }> = {
  0: { t: "none", o: 1, z: 5 },
  1: { t: "translate(18px,14px) rotate(3deg) scale(.96)", o: 0.92, z: 4 },
  2: { t: "translate(-14px,26px) rotate(-2.5deg) scale(.92)", o: 0.75, z: 3 },
  3: { t: "translate(0,34px) scale(.88)", o: 0, z: 2 },
};

/** La tarjeta que acaba de pasar (última posición) sale volando hacia la izquierda. */
const LEAVING = { t: "translate(-70%,-10px) rotate(-9deg)", o: 0, z: 6 };

/**
 * «El proceso» de la home: a la izquierda el título de cada paso (desktop), a la derecha un mazo de tarjetas con
 * captura real de la app y la explicación. Rota solo cada 7 s (pausa con hover/foco/botón y respeta
 * prefers-reduced-motion). En mobile: una tarjeta a ancho completo con swipe, flechas y puntos.
 * Client component: ver nota en HoverFeatureList.tsx sobre el RSC boundary (solo recibe datos serializables).
 */
export function HowItWorksSteps({ steps }: { steps: Step[] }) {
  const n = steps.length;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const [wide, setWide] = useState(false);
  const [drag, setDrag] = useState(0);
  const x0 = useRef<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const mqWide = window.matchMedia("(min-width: 1024px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setWide(mqWide.matches);
    sync();
    if (mqMotion.matches) setPlaying(false);
    mqWide.addEventListener("change", sync);
    return () => mqWide.removeEventListener("change", sync);
  }, []);

  const running = playing && wide && !hover;
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % n), DUR);
    return () => clearTimeout(id);
  }, [running, active, n]);

  const goMobile = useCallback((i: number) => setActive(Math.max(0, Math.min(n - 1, i))), [n]);

  function onKeyTab(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
    setPlaying(false);
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-14"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
    >
      {/* Títulos de los pasos (solo desktop) */}
      <div className="hidden lg:block">
        <div role="tablist" aria-label="Pasos del proceso" aria-orientation="vertical" className="grid gap-1">
          {steps.map((s, i) => {
            const selected = i === active;
            return (
              <button
                key={s.title}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`proc-tab-${i}`}
                aria-selected={selected}
                aria-controls={`proc-card-${i}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setPlaying(false);
                  setActive(i);
                }}
                onKeyDown={(e) => onKeyTab(e, i)}
                className="relative grid w-full grid-cols-[44px_1fr] items-center gap-3.5 rounded-field px-4 py-3 text-left transition-colors duration-200 hover:bg-cream-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] font-display text-[17px] font-bold transition-[background-color,border-color,color,transform] duration-300 ease-bounce ${
                    selected ? "step-halo scale-110 border-forest bg-forest text-white" : "border-line-2 bg-paper text-ink-faint"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`font-display text-[22px] font-bold leading-tight tracking-tight transition-[color,transform] duration-300 ${
                    selected ? "translate-x-1 text-ink" : "text-ink-faint"
                  }`}
                >
                  {s.title}
                </span>
                <span aria-hidden className="absolute bottom-1 left-[74px] right-4 h-[3px] overflow-hidden rounded-full bg-cream-2 opacity-0 data-[on=true]:opacity-100" data-on={selected}>
                  <i
                    className="block h-full origin-left bg-forest"
                    style={{ transform: `scaleX(${selected && running ? 1 : 0})`, transition: selected && running ? `transform ${DUR}ms linear` : "none" }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2.5 flex items-center gap-2.5 pl-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pausar la rotación" : "Reanudar la rotación"}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[13px] font-semibold text-forest-700 hover:bg-forest-tint focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-forest"
          >
            <Icon name={playing ? "pause" : "play_arrow"} className="text-lg" />
            {playing ? "Pausar" : "Reanudar"}
          </button>
          <span className="text-xs text-ink-faint" aria-live="polite">
            {playing ? "" : "Rotación en pausa"}
          </span>
        </div>
      </div>

      {/* Mazo (desktop) / carrusel (mobile) */}
      <div className="min-w-0">
        <div
          className="relative max-lg:overflow-hidden max-lg:rounded-card max-lg:[touch-action:pan-y] lg:h-[520px] lg:[perspective:1200px]"
          role="group"
          aria-roledescription="carrusel"
          aria-label="Pasos del proceso"
          onPointerDown={(e) => {
            if (wide) return;
            x0.current = e.clientX;
            setDrag(0);
          }}
          onPointerMove={(e) => {
            if (x0.current === null) return;
            setDrag(e.clientX - x0.current);
          }}
          onPointerUp={() => {
            if (x0.current === null) return;
            x0.current = null;
            if (drag < -50) goMobile(active + 1);
            else if (drag > 50) goMobile(active - 1);
            setDrag(0);
          }}
          onPointerCancel={() => {
            x0.current = null;
            setDrag(0);
          }}
          onKeyDown={(e) => {
            if (wide) return;
            if (e.key === "ArrowRight") goMobile(active + 1);
            if (e.key === "ArrowLeft") goMobile(active - 1);
          }}
        >
          <div
            className={`flex max-lg:translate-x-[var(--tx)] lg:contents ${drag ? "" : "max-lg:transition-transform max-lg:duration-500"}`}
            style={{ "--tx": `calc(${-100 * active}% + ${drag}px)` } as CSSProperties}
          >
            {steps.map((s, i) => {
              const pos = (i - active + n) % n;
              const d = pos === n - 1 ? LEAVING : (DECK[pos] ?? DECK[3]);
              const front = i === active;
              return (
                <article
                  key={s.title}
                  id={`proc-card-${i}`}
                  role="tabpanel"
                  aria-labelledby={`proc-tab-${i}`}
                  aria-roledescription="paso"
                  aria-label={`Paso ${i + 1} de ${n}`}
                  inert={!front}
                  className="flex flex-none basis-full flex-col overflow-hidden rounded-card border border-line bg-paper shadow-card lg:absolute lg:inset-0 lg:basis-auto lg:rounded-[30px] lg:[transform-origin:50%_90%] lg:[transform:var(--t)] lg:[opacity:var(--o)] lg:[z-index:var(--z)] lg:transition-[transform,opacity] lg:duration-700 lg:ease-out-fresh"
                  style={{ "--t": d.t, "--o": d.o, "--z": d.z, pointerEvents: front || !wide ? undefined : "none" } as CSSProperties}
                >
                  {/* <picture>: el navegador descarga una sola captura (móvil propia bajo lg, escritorio desde lg) */}
                  <div className="relative aspect-[6/5] overflow-hidden border-b border-line bg-cream lg:aspect-video">
                    <span aria-hidden className="absolute inset-x-0 top-0 z-10 hidden h-[26px] items-center gap-[5px] border-b border-line bg-cream-2 px-3 lg:flex">
                      <i className="h-2 w-2 rounded-full bg-line-2" />
                      <i className="h-2 w-2 rounded-full bg-line-2" />
                      <i className="h-2 w-2 rounded-full bg-line-2" />
                    </span>
                    {/* LEG-017: las capturas muestran residencias y precios de demostración. */}
                    <span className="absolute right-3 top-3 z-20 rounded-md bg-amber-soft-100 px-2 py-0.5 text-xs font-bold text-amber-soft-700 lg:top-[34px]">
                      Datos de ejemplo
                    </span>
                    <div className="absolute inset-x-0 bottom-0 top-0 lg:top-[26px]">
                      <picture>
                        <source media="(min-width: 1024px)" srcSet={shotProps(s.img, "640px").srcSet} sizes="640px" />
                        <img {...shotProps(s.imgMobile, "100vw")} alt={s.alt} className="h-full w-full object-cover object-top lg:object-left-top" draggable={false} loading="lazy" />
                      </picture>
                    </div>
                  </div>
                  <div className={`grid flex-1 content-start gap-2 bg-forest-ink p-[18px] pb-5 lg:flex-none lg:px-6 lg:pb-6 lg:pt-[22px] ${front ? "" : "lg:[&>*]:invisible"}`}>
                    <span className="text-xs font-bold text-amber-soft-300">Paso {i + 1}</span>
                    <h3 className="text-xl text-white lg:text-[22px]">{s.title}</h3>
                    <p className="text-[15px] leading-relaxed text-forest-tint">{s.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Navegación mobile */}
        <div className="mt-3.5 flex items-center justify-between gap-2 lg:hidden">
          <button
            type="button"
            aria-label="Paso anterior"
            disabled={active === 0}
            onClick={() => goMobile(active - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-paper text-forest-700 disabled:opacity-35"
          >
            <Icon name="arrow_back" />
          </button>
          <div className="flex gap-0.5">
            {steps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Paso ${i + 1}: ${s.title}`}
                aria-current={i === active}
                onClick={() => goMobile(i)}
                className="relative flex h-11 w-6 items-center justify-center before:absolute before:-inset-x-2.5 before:inset-y-0 before:content-['']"
              >
                <i className={`h-2 rounded-full transition-[width,background-color] duration-300 ease-bounce ${i === active ? "w-[22px] bg-forest" : "w-2 bg-line-2"}`} />
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Paso siguiente"
            disabled={active === n - 1}
            onClick={() => goMobile(active + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-2 bg-paper text-forest-700 disabled:opacity-35"
          >
            <Icon name="arrow_forward" />
          </button>
        </div>
      </div>
    </div>
  );
}
