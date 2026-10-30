import type { ReactNode } from "react";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Cuenta con acento de atención (naranja) cuando no está seleccionado. */
  attention?: boolean;
  icon?: ReactNode;
}

/**
 * Filtros en chips del kit logueado: `aria-pressed`, desplazables en mobile, 44 px de alto.
 * Controlado: el padre guarda el valor. Sin estado propio ni JS extra.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
  tone,
  className = "",
}: {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo. */
  label: string;
  tone?: RoleTone;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`${toneClass(tone)} flex gap-2 overflow-x-auto pb-0.5 ${className}`}>
      {options.map((o) => {
        const pressed = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(o.value)}
            className={`inline-flex min-h-11 flex-none cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold transition-all duration-300 ease-bounce hover:-translate-y-px focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${
              pressed ? "border-(--tone) bg-(--tone) text-white" : "border-line-2 bg-paper text-ink-soft hover:bg-cream-2"
            }`}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined && (
              <b
                className={`rounded-full px-1.5 text-[11.5px] font-bold leading-5 ${
                  pressed ? "bg-white/25" : o.attention && o.count > 0 ? "bg-orange text-white" : "bg-black/[0.08]"
                }`}
              >
                {o.count}
              </b>
            )}
          </button>
        );
      })}
    </div>
  );
}
