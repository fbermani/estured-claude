import { Icon } from "@/components/ui/Icon";
import { EarlyAccessPill } from "@/components/preapertura/EarlyAccessPill";

/**
 * Panel izquierdo del registro familiar (SPEC pantalla 4): beneficios de acompañar. Sin promesas de disponibilidad ni de reserva.
 * En ancho angosto queda solo la píldora y el titular; la lista y el esquema de los dos perfiles aparecen desde 860 px del popup.
 */
export function FamilyBenefitsPanel() {
  return (
    <aside
      aria-label="Por qué acompañar con EstuRed"
      className="grid grid-cols-[minmax(0,1fr)] content-start gap-3.5 overflow-hidden rounded-card surface-forest bg-forest-ink p-5 text-white @min-[860px]:gap-5 @min-[860px]:p-9"
    >
      <div className="justify-self-start">
        <EarlyAccessPill>Acceso anticipado</EarlyAccessPill>
      </div>
      <h2 className="font-display text-[clamp(22px,3.4vw,32px)] leading-[1.08] tracking-tight">
        Acompañá su mudanza a Buenos Aires <span className="text-orange-light">desde donde estés.</span>
      </h2>
      <ul className="hidden gap-2.5 @min-[860px]:grid">
        <Tick icon="verified">Residencias visitadas en persona, no solo fotos.</Tick>
        <Tick icon="visibility">Seguís cada solicitud y cada pago, paso a paso.</Tick>
        <Tick icon="bolt">Se enteran primero cuando abramos.</Tick>
        <Tick icon="sell">Gratis para los dos.</Tick>
        <Tick icon="shield_person">Si es menor de 18, se suma con tu invitación.</Tick>
      </ul>
      <div aria-hidden="true" className="hidden items-center gap-2.5 rounded-field bg-paper p-3 text-ink shadow-card @min-[860px]:flex">
        <span className="grid size-[42px] place-items-center rounded-full bg-peach font-display text-[17px] font-bold text-orange-700">M</span>
        <div className="text-sm leading-tight">
          <b>Vos</b>
          <small className="block text-xs text-ink-faint">Familiar</small>
        </div>
        <span className="relative h-0.5 flex-1 border-t-2 border-dashed border-forest">
          <Icon name="link" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper p-0.5 text-xl text-forest-700" />
        </span>
        <div className="text-right text-sm leading-tight">
          <b>Tu hijo/a</b>
          <small className="block text-xs text-ink-faint">Estudiante</small>
        </div>
        <span className="grid size-[42px] place-items-center rounded-full bg-mint font-display text-[17px] font-bold text-forest-700">L</span>
      </div>
    </aside>
  );
}

function Tick({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] font-semibold text-white/95">
      <Icon name={icon} className="text-[22px] text-gold" />
      {children}
    </li>
  );
}
