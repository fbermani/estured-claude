"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, ReactElement } from "react";

/**
 * Entrada escalonada de una sola vez (`.stagger-in`, `fade-in-left` en `app/globals.css`): cada hijo entra con un
 * pequeño retraso la primera vez que el bloque aparece en pantalla. Clona el hijo y le suma
 * las clases, así no agrega wrappers (importa en carruseles con `flex` y `snap`).
 * Si el bloque ya está a la vista al cargar, no se oculta nada. `prefers-reduced-motion`
 * lo resuelve la regla global de `globals.css` (duración de 0,01 ms).
 */
export function StaggerIn({
  children,
  step = 0.15,
  duration = 0.6,
  ...rest
}: ComponentProps<"div"> & { step?: number; duration?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setVisible(true);
      return;
    }
    // Recién ahora se arma el estado oculto (bajo el pliegue, así no hay parpadeo).
    setArmed(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hidden = armed && !visible;

  return (
    <div ref={ref} {...rest}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ className?: string; style?: CSSProperties }>;
        if (!visible) {
          return cloneElement(el, {
            className: `${el.props.className ?? ""} ${hidden ? "opacity-0" : ""}`.trim(),
          });
        }
        return cloneElement(el, {
          className: `${el.props.className ?? ""} stagger-in`.trim(),
          style: {
            ...el.props.style,
            animationDelay: `${i * step}s`,
            animationDuration: `${duration}s`,
          },
        });
      })}
    </div>
  );
}
