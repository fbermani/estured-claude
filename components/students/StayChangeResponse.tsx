import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatUsd } from "@/lib/mock/exchange";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";

export type StayChangeResponseData = {
  message: string | null;
  exitCostsText: string | null;
  exitCostsUsd: number | null;
  exitConditionsText: string | null;
  exitDetailsText: string | null;
  respondedAt: string;
  edited: boolean;
};

/**
 * Respuesta de la residencia al aviso "Quiero cambiar" (SPEC §3.5). Una sola card para el estudiante, el familiar
 * (variante compacta, sin acciones) y la vista previa de la residencia. Las filas vacías no se muestran. Es informativa:
 * no modifica el contrato y los costos los informa la residencia, no EstuRed.
 */
export function StayChangeResponse({
  response,
  residenceName,
  variant,
  id,
  conditionsHref,
}: {
  response: StayChangeResponseData;
  residenceName: string;
  variant: "student" | "family" | "preview";
  id?: string;
  /** Detalle de la reserva (comprobante / solicitud) para "Ver condiciones de mi reserva". */
  conditionsHref?: string | null;
}) {
  const initials = residenceName
    .replace(/^Residencia\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const when = formatDateOnly(response.respondedAt.slice(0, 10));
  const rows: { key: string; icon: string; label: string; text: string | null; usd?: number | null; warm?: boolean }[] = [
    { key: "costs", icon: "payments", label: "Costos de salida", text: response.exitCostsText, usd: response.exitCostsUsd, warm: true },
    { key: "conditions", icon: "rule", label: "Condiciones", text: response.exitConditionsText },
    { key: "details", icon: "logout", label: "Detalles de la salida", text: response.exitDetailsText },
  ];
  const visibleRows = rows.filter((r) => r.text || r.usd != null);
  const compact = variant === "family";

  return (
    <section id={id} aria-labelledby={`${id ?? "stay-change-response"}-title`} className="scroll-mt-24 overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-tint text-sm font-extrabold text-forest-700">
          {initials || "R"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id ?? "stay-change-response"}-title`} className="font-bold text-ink">
            {compact ? "Lo que informó la residencia" : `Lo que te informó ${residenceName}`}
          </h3>
          <p className="text-xs text-ink-faint">
            Respuesta del {when}
            {response.edited ? " · Actualizada" : ""}
          </p>
        </div>
        <Badge tone="petrol" className="hidden sm:inline-flex">
          Informativo
        </Badge>
      </header>

      <div className="space-y-4 px-5 py-5">
        {response.message && (
          <blockquote className="border-l-4 border-forest pl-4 text-sm leading-relaxed text-ink">{response.message}</blockquote>
        )}
        {visibleRows.length > 0 && (
          <dl className="divide-y divide-line overflow-hidden rounded-field border border-line">
            {visibleRows.map((row) => (
              <div key={row.key} className={`px-4 py-3 ${row.warm ? "bg-orange-tint/40" : "bg-paper"}`}>
                <dt className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
                  <Icon name={row.icon} className="text-sm text-forest-700" />
                  {row.label}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink">
                  {row.text && <span className="whitespace-pre-line">{row.text}</span>}
                  {row.usd != null && (
                    <span className="mt-1 block text-xs font-semibold text-ink-soft">
                      Monto de referencia: {formatUsd(row.usd)}. Es informativo: no es un cobro de EstuRed.
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <footer className="flex flex-col gap-2 border-t border-line bg-cream-2/60 px-5 py-3.5 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md leading-relaxed">
          Esta información la carga {compact || variant === "preview" ? "la residencia" : "tu residencia"}. No modifica el contrato; ante dudas, escribí a
          Soporte. {variant !== "preview" && UNPAID_DISCLAIMER}
        </p>
        {variant === "student" && (
          <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 font-bold text-forest-700">
            {conditionsHref && (
              <Link href={conditionsHref} className="hover:underline">
                Ver condiciones de mi reserva
              </Link>
            )}
            <Link href="/students/support" className="hover:underline">
              Escribir a Soporte
            </Link>
          </div>
        )}
      </footer>
    </section>
  );
}
