"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Reveal-on-scroll (design-references/fresh-style.md §3 "Reveal on
 * scroll" — spec ya definida, nunca implementada). `prefers-reduced-motion`
 * ya está cubierto por la regla global en app/globals.css (colapsa
 * transition-duration a ~0), así que acá no hace falta condicional propia.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Lo que ya está a la vista al cargar no se oculta ni se anima (evita el primer viewport en blanco).
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -24px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "in" : ""} ${delay ? `reveal-d${delay}` : ""} ${className}`}
    >
      {children}
    </div>
  );
}
