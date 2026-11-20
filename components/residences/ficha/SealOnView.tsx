"use client";

import { useEffect, useRef, useState } from "react";
import { EsturedSeal } from "@/components/brand/EsturedSeal";

/**
 * Sello «Verificada» sobre fondo claro que «cae» (golpe de sello) la primera vez que entra en pantalla. Sin JavaScript, o si ya se ve al
 * cargar la página, el sello aparece quieto y visible (nunca queda oculto). Solo transform y opacity; con `prefers-reduced-motion` el
 * CSS del sello ya anula la animación. Decorativo: el significado lo dice el texto de al lado.
 */
export function SealOnView({ size = 104, className = "" }: { size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // `hidden`: armado (solo con JS y bajo el pliegue); `stamped`: ya disparó el golpe.
  const [state, setState] = useState<"idle" | "hidden" | "stamped">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return; // ya a la vista: queda quieto
    setState("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("stamped");
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={`inline-flex shrink-0 ${className}`} style={{ width: size, height: size, opacity: state === "hidden" ? 0 : 1 }}>
      <EsturedSeal size={size} onLight stamp={state === "stamped"} className="size-full" />
    </span>
  );
}
