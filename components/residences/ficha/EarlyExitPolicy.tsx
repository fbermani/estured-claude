import { Icon } from "@/components/ui/Icon";

/**
 * "Si te vas antes" (DR3, SPEC §4): política de salida anticipada de la residencia, visible ANTES de reservar. Es texto
 * libre e informativo que la residencia carga en su perfil; EstuRed no lo fija ni lo cobra. Sin datos, no se muestra.
 */
export function EarlyExitPolicy({
  depositClausesText,
  costsText,
  conditionsText,
}: {
  depositClausesText: string | null;
  costsText: string | null;
  conditionsText: string | null;
}) {
  const rows = [
    { key: "costs", icon: "payments", label: "Costos de salida anticipada", text: costsText },
    { key: "deposit", icon: "savings", label: "Depósito: cláusulas básicas", text: depositClausesText },
    { key: "conditions", icon: "rule", label: "Condiciones", text: conditionsText },
  ].filter((row) => row.text?.trim());
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="early-exit-title" className="mt-4 rounded-sm border-[1.5px] border-line bg-paper p-4 shadow-card sm:p-5">
      <h3 id="early-exit-title" className="flex items-center gap-2 font-display text-lg font-extrabold text-ink">
        <Icon name="logout" className="text-xl text-forest-700" />
        Si te vas antes
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Lo informa la residencia y lo ves antes de reservar. Si más adelante querés cambiarte, te va a confirmar costos y condiciones por escrito.
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className={`rounded-field bg-cream-2/60 p-3.5 ${rows.length === 3 && row.key === "conditions" ? "sm:col-span-2" : ""}`}>
            <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
              <Icon name={row.icon} className="text-base text-forest-700" />
              {row.label}
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{row.text}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        Es información de la residencia: EstuRed no fija ni cobra estos costos y no reemplaza el contrato.
      </p>
    </section>
  );
}
