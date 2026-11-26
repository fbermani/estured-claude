import { Icon } from "@/components/ui/Icon";
import { BenefitList } from "@/components/preapertura/BenefitList";

/**
 * Panel izquierdo del registro del estudiante (DR67): el titular, los tres beneficios y que es gratis. Sin número de registro (se ve
 * recién después de sumarse) ni carrusel. Solo aparece desde 860 px del popup; en angosto queda el formulario solo.
 */
export function UrgencyPanel() {
  return (
    <aside
      aria-label="Por qué sumarte"
      className="hidden content-center gap-5 rounded-card bg-forest-ink p-9 text-white @min-[860px]:grid"
    >
      <h2 className="font-display text-[clamp(22px,3.4vw,32px)] leading-[1.08] tracking-tight">
        Mientras otros buscan a ciegas, <span className="text-orange-light">vos te enterás primero.</span>
      </h2>
      <BenefitList variant="ticks" />
      <p className="flex items-center gap-2.5 font-semibold">
        <Icon name="sell" className="text-gold" />
        Gratis. Sin tarjeta.
      </p>
    </aside>
  );
}
