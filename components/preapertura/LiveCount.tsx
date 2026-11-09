import type { StudentCounter } from "@/lib/preapertura/rules";

const FACES = [
  { letter: "M", tone: "bg-mint text-forest-700" },
  { letter: "J", tone: "bg-peach text-orange-700" },
  { letter: "V", tone: "bg-lilac text-lilac-fg" },
  { letter: "+", tone: "bg-sky text-sky-fg" },
] as const;

/**
 * Contador REAL de estudiantes (DR43.5). Con menos de 25 registrados (o si la consulta falla) muestra «Sé de los primeros»:
 * un número chico resta confianza y nunca se inventa uno. `role="status"` para que un cambio se anuncie.
 */
export function LiveCount({ counter, className = "" }: { counter: StudentCounter; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2.5 text-sm text-ink-soft ${className}`}>
      {counter.kind === "number" ? (
        <>
          <span aria-hidden="true" className="flex">
            {FACES.map((f, i) => (
              <span
                key={f.letter}
                className={`grid size-[30px] place-items-center rounded-full border-2 border-paper font-display text-xs font-bold ${f.tone} ${i > 0 ? "-ml-2" : ""}`}
              >
                {f.letter}
              </span>
            ))}
          </span>
          <span>
            <b className="font-display text-lg tabular-nums text-ink">{counter.count.toLocaleString("es-AR")}</b> estudiantes ya se sumaron
          </span>
        </>
      ) : (
        <span>
          <b className="font-display text-lg text-ink">Sé de los primeros</b> en sumarte
        </span>
      )}
    </div>
  );
}
