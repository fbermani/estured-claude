import type { StudentCounter } from "@/lib/preapertura/rules";

/**
 * Contador REAL de estudiantes (DR43.5). Con menos de 25 registrados (o si la consulta falla) no dibuja nada: un número chico resta
 * confianza y nunca se inventa uno. `role="status"` para que un cambio se anuncie.
 */
export function LiveCount({ counter }: { counter: StudentCounter }) {
  if (counter.kind === "first") return null;
  return (
    <p role="status" className="pre-counter text-center text-sm text-ink-soft">
      <b className="font-display text-base tabular-nums text-ink">{counter.count.toLocaleString("es-AR")}</b> estudiantes ya se sumaron
    </p>
  );
}
