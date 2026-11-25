import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { paymentMethodLabel } from "@/lib/payments/paymentMethods";
import type { CollectionCardSummary } from "@/lib/residences/reservationCollectionDb";
import {
  METHOD_DATA_STATE_LABELS,
  RESERVATION_MODE_LABELS,
  explicitReservationModes,
  type MethodDataState,
} from "@/lib/residences/reservationCollection";

const LINK_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-forest bg-paper px-5 text-sm font-bold text-forest-700 transition-colors hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

const STATE_TONE: Record<MethodDataState, "neutral" | "amber" | "sage" | "danger"> = { none: "neutral", pending: "amber", approved: "sage", rejected: "danger" };

/**
 * Tarjeta «Cobro de la reserva» de la configuración (DR63). Solo resume: la edición y los datos de cobro viven en
 * `/residence/<id>/collection`, que es SOLO del dueño. Acá no viaja ningún dato de cobro: solo las opciones elegidas y el estado de cada
 * medio («Sin datos», «Cargado»; DR65 (c): sin aprobación del admin). El staff ve el aviso y las opciones, sin estados ni enlace.
 */
export function ProfileCollectionCard({
  residenceId,
  summary,
  isOwner,
}: {
  residenceId: string;
  /** `null` = no disponible en este momento o en este entorno (migración 0102 pendiente). */
  summary: CollectionCardSummary | null;
  isOwner: boolean;
}) {
  const modes = summary ? explicitReservationModes(summary.modes) : [];
  const accepted = summary ? (summary.acceptedMethods ?? []) : [];
  const showMethods = isOwner && summary !== null && modes.includes("enabled_methods") && accepted.length > 0;

  return (
    <Card id="perfil-cobro" className="p-6 max-lg:scroll-mt-14">
      <h2 className="text-lg font-bold text-ink">Cobro de la reserva</h2>
      <p className="mt-1 text-sm text-ink-soft">Esto define solo el pago de la reserva. Los pagos siguientes los acordás con cada estudiante.</p>

      {summary === null ? (
        <p role="status" className="mt-4 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">
          Esta sección todavía no está disponible. Probá de nuevo en unos minutos; si sigue pasando, avisale a Soporte.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {modes.length === 0 ? (
            <p className="rounded-field border-[1.5px] border-line bg-cream px-4 py-3 text-sm font-semibold text-ink">Todavía no elegiste cómo cobrás la reserva.</p>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Opciones de cobro activas">
              {modes.map((mode) => (
                <li key={mode}>
                  <Badge tone="petrol">{RESERVATION_MODE_LABELS[mode]}</Badge>
                </li>
              ))}
            </ul>
          )}

          {showMethods && (
            <ul className="space-y-1.5" aria-label="Medios que aceptás">
              {accepted.map((key) => {
                const state: MethodDataState = summary.states[key] ?? "none";
                return (
                  <li key={key} className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span className="font-semibold">{paymentMethodLabel(key)}</span>
                    <Badge tone={STATE_TONE[state]}>{METHOD_DATA_STATE_LABELS[state]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {isOwner ? (
        <div className="mt-4">
          <a href={`/residence/${residenceId}/collection`} className={LINK_CLASS}>
            {summary !== null && explicitReservationModes(summary.modes).length > 0 ? "Editar el cobro de la reserva" : "Configurar el cobro de la reserva"}
            <Icon name="arrow_forward" className="text-lg" aria-hidden />
          </a>
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-1.5 text-sm text-ink-soft">
          <Icon name="lock" className="mt-px text-base" />
          <span>Solo el dueño puede ver y editar los datos de cobro.</span>
        </p>
      )}
    </Card>
  );
}
