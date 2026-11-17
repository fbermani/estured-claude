import { Icon } from "@/components/ui/Icon";
import type { AgeFacts } from "@/lib/residences/fichaAge";

/**
 * «Edad de los residentes» del capítulo «La comunidad»: el rango que admite la residencia y, si hay datos suficientes, la edad
 * promedio de la comunidad vigente (`buildAgeFacts`; el promedio ya viene filtrado por privacidad: solo con más de 10 edades válidas y
 * nunca una fecha individual). Sin rango ni promedio no se dibuja nada. `acceptsMinors` suma el aviso para menores de 18.
 */
export function ResidentAge({ facts, acceptsMinors }: { facts: AgeFacts; acceptsMinors: boolean }) {
  if (!facts.rangeLabel && !facts.average) return null;
  const tiles: { key: string; icon: string; label: string; value: string; sub?: string }[] = [];
  if (facts.rangeLabel) tiles.push({ key: "rango", icon: "badge", label: "Edades que admite", value: facts.rangeLabel });
  if (facts.average) {
    tiles.push({
      key: "promedio",
      icon: "cake",
      label: "Edad promedio hoy",
      value: `${facts.average.years} años`,
      sub: `Entre ${facts.average.residents} residentes`,
    });
  }

  return (
    <div id="edad" className="scroll-mt-36 space-y-3">
      <h3 className="font-display text-xl font-bold text-ink">Edad de los residentes</h3>
      <ul role="list" className={`grid list-none gap-3 p-0 ${tiles.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {tiles.map((t) => (
          <li key={t.key} className="flex items-start gap-3 rounded-card border-[1.5px] border-line bg-paper px-4 py-3.5 shadow-card">
            <Icon name={t.icon} className="mt-0.5 text-2xl text-forest-700" />
            <div className="min-w-0">
              <span className="block text-[13px] text-ink-faint">{t.label}</span>
              <span className="block font-display text-xl font-bold tabular-nums text-ink">{t.value}</span>
              {t.sub && <span className="block text-[13px] tabular-nums text-ink-soft">{t.sub}</span>}
            </div>
          </li>
        ))}
      </ul>
      {acceptsMinors && (
        <div className="rounded-card border-[1.5px] border-line bg-paper p-5">
          <h4 className="text-base font-bold text-ink">Para menores de 18</h4>
          <p className="mt-2 text-[15px] text-ink-soft">
            Esta residencia admite residentes menores de 18. Consultá con la residencia las condiciones que aplican y, al solicitar,
            tu guardián deberá confirmar la solicitud. La solicitud queda sujeta a confirmación de la residencia.
          </p>
        </div>
      )}
    </div>
  );
}
