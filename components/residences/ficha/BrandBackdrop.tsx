import { MARK_PATHS, MARK_VIEWBOX } from "@/lib/brand/markPath";

/**
 * Ilustración de marca para cuando todavía no hay una foto: el isotipo de EstuRed, grande y tenue, sobre forest. Es el estado provisional
 * del hero, de las tarjetas de habitación y del mosaico; no es una foto ni la imita. Va dentro de un contenedor `relative overflow-hidden`.
 */
export function BrandBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`absolute inset-0 flex items-start justify-center overflow-hidden bg-forest-700 ${className}`}>
      <svg viewBox={MARK_VIEWBOX} className="mt-[6%] h-[78%] w-auto max-w-none text-paper opacity-[0.07]" focusable="false">
        {MARK_PATHS.map((p) => (
          <path key={p.fill} d={p.d} fill="currentColor" fillRule="evenodd" />
        ))}
      </svg>
    </div>
  );
}
