import { Icon } from "@/components/ui/Icon";

/** Los tres beneficios del popup (DR67 i, texto del dueño). Fuente única: popup de entrada y panel del registro. */
export const BENEFITS = [
  { icon: "verified", label: "Residencias verificadas en persona" },
  { icon: "receipt_long", label: "Reglas y costos claros" },
  { icon: "groups", label: "Conocé la comunidad antes de elegir" },
] as const;

/** `tiles`: tres mosaicos del popup de entrada. `ticks`: lista vertical sobre fondo oscuro (panel del registro). */
export function BenefitList({ variant }: { variant: "tiles" | "ticks" }) {
  const tiles = variant === "tiles";
  return (
    <ul className={tiles ? "pre-bens grid grid-cols-3" : "grid gap-3"}>
      {BENEFITS.map((benefit) => (
        <li
          key={benefit.label}
          className={
            tiles
              ? "grid content-start justify-items-center gap-1.5 rounded-field bg-forest-tint text-center font-bold leading-tight text-forest-700"
              : "flex items-center gap-2.5 font-semibold"
          }
        >
          <Icon name={benefit.icon} className={`shrink-0 text-xl ${tiles ? "pre-bens-icon" : "text-gold"}`} />
          {benefit.label}
        </li>
      ))}
    </ul>
  );
}
