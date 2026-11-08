import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { SwipeStack } from "@/components/ui/SwipeStack";

/**
 * Beneficios para residencias: 4 tarjetas iguales «ancla + título». Ancla enorme (artefacto real del producto),
 * título fuerte, una línea y un mini ejemplo rotulado (datos ficticios). En mobile, mazo con swipe (SwipeStack).
 */

type Benefit = {
  anchor: string;
  code?: boolean;
  tone: "forest" | "orange";
  title: string;
  line: string;
  exampleLabel: string;
  example: ReactNode;
};

const BENEFITS: Benefit[] = [
  {
    anchor: "1 ficha",
    tone: "forest",
    title: "Menos consultas repetidas",
    line: "Tu ficha responde precio, reglas y qué incluye.",
    exampleLabel: "Ejemplo: la ficha ya responde precio, qué incluye y reglas.",
    example: <Badge tone="sage">Precio · reglas ✓</Badge>,
  },
  {
    anchor: "1 lista",
    tone: "orange",
    title: "Renovaciones y lista de espera juntas",
    line: "Sabés quién sigue y a quién avisar.",
    exampleLabel: "Ejemplo: Estudiante E. decidió esperar. El aviso no reserva la plaza, sujeta a confirmación.",
    example: <Badge>Decidió esperar</Badge>,
  },
  {
    anchor: "ER-0427",
    code: true,
    tone: "forest",
    title: "Reservas y pagos con registro",
    line: "Lo acordado y cobrado, por escrito.",
    exampleLabel: "Ejemplo: comprobante ER-0427 registrado.",
    example: <Badge tone="sage">Registrado</Badge>,
  },
  {
    anchor: "3 en común",
    tone: "orange",
    title: "Afinidad de convivencia antes de aceptar",
    line: "Ves hábitos en común con quien ya vive ahí.",
    exampleLabel: "Ejemplo: tres hábitos en común con quien ya vive en la habitación.",
    example: <Badge tone="sage">✓ No fuma</Badge>,
  },
];

export function BenefitBeforeAfter() {
  return (
    <SwipeStack label="Beneficios para residencias" className="grid gap-3 md:grid-cols-2 md:gap-4">
      {BENEFITS.map((b) => (
        <article
          key={b.title}
          className="group grid h-full grid-rows-[auto_auto_1fr_auto] gap-2 rounded-card border border-line bg-paper p-5 shadow-card transition-shadow motion-reduce:transition-none sm:p-6 md:hover:shadow-card-hover"
        >
          <p
            className={`font-bold leading-none ${
              b.code
                ? "font-mono text-[38px] tracking-normal sm:text-[44px]"
                : "font-display text-[44px] tracking-tight sm:text-[52px]"
            } ${b.tone === "forest" ? "text-forest" : "text-orange-700"}`}
          >
            {b.anchor}
          </p>
          <h3 className="mt-1 text-[22px] font-bold leading-tight text-ink sm:text-2xl">{b.title}</h3>
          <p className="text-[15px] text-ink-soft">{b.line}</p>
          <p
            role="img"
            aria-label={b.exampleLabel}
            className="mt-2 flex items-center gap-2 border-t border-line pt-3"
          >
            <span className="text-[10px] font-medium uppercase leading-none tracking-wide text-ink-faint">Ejemplo</span>
            {b.example}
          </p>
        </article>
      ))}
    </SwipeStack>
  );
}
