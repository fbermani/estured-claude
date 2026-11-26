import { FOUNDER_CAPACITY } from "@/lib/preapertura/rules";

/**
 * Medidor del cupo REAL de Residencias fundadoras (DR46.1): `taken` de `FOUNDER_CAPACITY` lugares en proceso (se libera si una no
 * avanza). Un segmento por lugar; el estado nunca depende solo del color: lleva texto y `aria-label` con los números.
 */
export function FounderMeter({ taken, caption }: { taken: number; caption?: React.ReactNode }) {
  const filled = Math.min(FOUNDER_CAPACITY, Math.max(0, Math.floor(taken)));
  return (
    <div className="grid min-w-[200px] flex-1 gap-1.5">
      <span
        role="img"
        aria-label={`Lugares de fundadora: ${filled} de ${FOUNDER_CAPACITY} en proceso`}
        className="flex h-2 gap-1"
      >
        {Array.from({ length: FOUNDER_CAPACITY }, (_, i) => (
          <i key={i} className={`flex-1 rounded-sm ${i < filled ? "bg-gold" : "bg-white/20"}`} />
        ))}
      </span>
      {caption && <small className="text-sm text-white/90">{caption}</small>}
    </div>
  );
}
