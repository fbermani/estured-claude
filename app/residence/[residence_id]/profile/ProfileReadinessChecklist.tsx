import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { readinessHeadline, type SubmitReadiness } from "@/lib/residences/submitReadiness";

/**
 * Fortaleza del perfil + lista de requisitos para enviar a revisión (DR59). Un solo componente para la tarjeta lateral (desde `lg`)
 * y la versión compacta de bajo `lg`: así las dos muestran lo mismo. Sin estado propio: se actualiza con lo que el formulario edita.
 * `canSend` = el dueño puede enviar ahora (es el dueño y el estado de la residencia lo permite): cambia el titular, no la lista.
 */
export function ProfileReadinessChecklist({
  readiness,
  percent,
  canSend,
  variant,
}: {
  readiness: SubmitReadiness;
  percent: number;
  canSend: boolean;
  variant: "card" | "compact";
}) {
  const required = readiness.items.filter((i) => i.required);
  const done = required.filter((i) => i.ok).length;
  const headline = readinessHeadline(readiness, canSend);
  const ready = readiness.canSubmit;

  const bar = (
    <div
      role="progressbar"
      aria-label="Fortaleza del Perfil"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 overflow-hidden rounded-full bg-sand-200"
    >
      <div className="h-full w-full origin-left rounded-full bg-forest transition-transform duration-300 ease-out-fresh" style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  );

  const list = (
    <ul className="space-y-1.5">
      {readiness.items.map((item) => (
        <li key={item.key} className="flex items-start gap-2 text-sm">
          <Icon name={item.ok ? "check_circle" : "radio_button_unchecked"} className={`mt-0.5 shrink-0 text-lg ${item.ok ? "text-forest-700" : "text-ink-faint"}`} />
          <span className="min-w-0">
            <span className={item.ok ? "text-ink-soft" : "font-semibold text-ink"}>
              {item.label}
              <span className="sr-only">{item.ok ? ": cumplido" : ": pendiente"}</span>
            </span>
            {!item.ok && item.hint && <span className="mt-0.5 block text-xs text-ink-soft">{item.hint}</span>}
            {!item.ok && item.href && (
              <Link href={item.href} className="mt-0.5 inline-block text-xs font-semibold text-forest-700 underline underline-offset-2">
                {item.href.startsWith("#") ? "Ir a la sección" : "Completar ahí"}
              </Link>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  if (variant === "compact") {
    return (
      <details className="mb-4 rounded-card border-[1.5px] border-line bg-paper px-4 py-3 lg:hidden">
        <summary className="cursor-pointer list-none">
          <span className="flex items-center gap-3">
            <span className="text-sm font-bold text-ink">Fortaleza del Perfil</span>
            <span className="flex-1">{bar}</span>
            <span className="text-sm font-bold tabular-nums text-forest-700">{percent}%</span>
          </span>
          <span role="status" className={`mt-1.5 block text-xs ${ready ? "font-semibold text-forest-700" : "text-ink-soft"}`}>
            {headline} <span className="underline">Ver requisitos ({done} de {required.length})</span>
          </span>
        </summary>
        <div className="mt-3 border-t border-line pt-3">{list}</div>
      </details>
    );
  }

  return (
    <>
      <h3 className="font-bold text-ink">Fortaleza del Perfil</h3>
      <div className="mt-2">{bar}</div>
      <p className="mt-1 text-right text-sm font-bold tabular-nums text-forest-700">{percent}%</p>
      <p role="status" className={`mt-2 rounded-field px-3 py-2 text-sm font-semibold ${ready ? "bg-forest-tint text-forest-700" : "bg-sand-100 text-ink"}`}>
        {headline}
      </p>
      <p className="mt-3 mb-2 text-xs font-semibold text-ink-soft">
        Requisitos para enviar: {done} de {required.length}
      </p>
      {list}
    </>
  );
}
