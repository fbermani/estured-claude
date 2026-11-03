import { Icon } from "@/components/ui/Icon";
import { policyOfferLabel } from "@/lib/availability/genderAvailability";
import type { RoomTypeOffer } from "@/types/domain";

/** Cantidad de personas por tipo de habitación (Individual = 1, Doble = 2…). «Compartida» no tiene un número fijo. */
const PERSONS: Record<string, number | null> = { Individual: 1, Doble: 2, Triple: 3, Cuádruple: 4, Compartida: null };
const ORDER = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];

/**
 * Tipos de habitación de la tarjeta de /search como íconos de personas: 1 hombrecito = individual, 2 = doble, etc.
 * Pasar el mouse (o enfocar con teclado) sobre un grupo muestra el nombre completo («Doble femenina, Doble masculina»).
 * Sin JavaScript: el tooltip es CSS (`group-hover` / `group-focus-visible`); el nombre también va en `aria-label`.
 */
export function RoomTypeIcons({ roomTypes }: { roomTypes: RoomTypeOffer[] }) {
  const byType = new Map<string, Set<string>>();
  for (const rt of roomTypes) {
    const labels = byType.get(rt.type) ?? new Set<string>();
    labels.add(policyOfferLabel(rt.type, rt.gender));
    byType.set(rt.type, labels);
  }
  const types = [...byType.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (types.length === 0) return null;

  return (
    <ul aria-label="Tipos de habitación" className="flex flex-wrap items-center gap-1.5">
      {types.map((type) => {
        const persons = PERSONS[type] ?? null;
        const labels = [...(byType.get(type) ?? [])];
        const text = labels.join(", ");
        return (
          <li key={type} className="group/tip relative">
            <span
              tabIndex={0}
              role="img"
              aria-label={persons ? `${text} (${persons} ${persons === 1 ? "persona" : "personas"})` : text}
              className="inline-flex h-8 items-center rounded-full border border-line bg-cream px-2 text-ink-soft transition-colors hover:border-sage-200 hover:bg-forest-tint hover:text-forest-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            >
              {persons ? (
                Array.from({ length: persons }).map((_, i) => <Icon key={i} name="person" className="-mx-px text-[19px]" />)
              ) : (
                <Icon name="groups" className="text-[21px]" />
              )}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-[12px] bg-forest-ink px-3 py-2 text-left text-[13px] leading-snug text-white shadow-float group-focus-within/tip:block group-hover/tip:block"
            >
              {labels.map((l) => (
                <b key={l} className="block text-[13px]">
                  {l}
                </b>
              ))}
              {persons && <span className="text-white/80">{persons === 1 ? "1 persona" : `${persons} personas`} por habitación</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
