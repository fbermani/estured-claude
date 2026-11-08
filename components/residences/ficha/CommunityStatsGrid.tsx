import type { CommunityStats } from "@/lib/residents/communityStats";

const SM_COLS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" };

/**
 * Fila de cifras de la comunidad (residentes hoy · países · rango de edad · carreras), compartida por la ficha y el
 * modal de /search. Cada cifra solo aparece si cumple sus mínimos de privacidad (`computeCommunityStats`); con una sola
 * cifra no se dibuja la fila.
 */
export function CommunityStatsGrid({ total, stats }: { total: number; stats: CommunityStats | null }) {
  const tiles = [
    { value: String(total), label: total === 1 ? "residente hoy" : "residentes hoy" },
    stats?.countries != null && { value: String(stats.countries), label: stats.countries === 1 ? "país de origen" : "países de origen" },
    stats?.ageRange && {
      value: stats.ageRange.min === stats.ageRange.max ? String(stats.ageRange.min) : `${stats.ageRange.min}–${stats.ageRange.max}`,
      label: "años",
    },
    stats?.careers != null && { value: String(stats.careers), label: stats.careers === 1 ? "carrera" : "carreras" },
  ].filter((t): t is { value: string; label: string } => Boolean(t));

  if (!stats || tiles.length <= 1) return null;
  return (
    <dl
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card ${SM_COLS[tiles.length] ?? "sm:grid-cols-4"}`}
      aria-label="Cifras de la comunidad"
    >
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={`grid bg-paper px-[18px] py-4 ${tiles.length % 2 === 1 && i === tiles.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
        >
          <dt className="order-2 text-[12.5px] text-ink-faint">{t.label}</dt>
          <dd className="order-1 font-display text-[28px] font-bold text-forest-700">{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}
