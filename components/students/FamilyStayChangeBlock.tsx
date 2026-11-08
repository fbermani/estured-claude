import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StayChangeResponse } from "@/components/students/StayChangeResponse";
import { ConfirmByFamilyButton } from "@/components/students/StayChangeInlineActions";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import type { StudentStayChangeView } from "@/lib/stayChange/load";
import { arDateOf } from "@/lib/stayChange/ui";

/**
 * Bloque de solo lectura del familiar vinculado (SPEC §6; `docs/08` §6.15): estado del aviso "Quiero cambiar" del estudiante
 * y, si la residencia respondió, costos y condiciones de salida. NUNCA muestra el mensaje privado del estudiante (la
 * proyección del servidor ya lo deja en `null`). Con un menor, el aviso queda pendiente hasta que el familiar lo confirma.
 */
export function FamilyStayChangeBlock({
  view,
  studentName,
  residenceName,
}: {
  view: StudentStayChangeView | null;
  studentName: string;
  residenceName: string | null;
}) {
  const live = view && ["open_no_response", "open_responded", "open_expiring", "pending_family"].includes(view.ui.key) ? view : null;
  const resolved = view?.ui.key === "resolved" ? view : null;

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        <Icon name="visibility" className="text-sm" /> Solo lectura
      </p>

      {!live && !resolved && (
        <p className="text-sm leading-relaxed text-ink-soft">
          {studentName} no está buscando un cambio. Si decide hacerlo, avisa a su residencia desde su panel y vos lo ves acá: la fecha estimada de salida y lo
          que la residencia informe sobre costos de salida.
        </p>
      )}

      {live?.ui.key === "pending_family" && (
        <div className="rounded-field border border-orange/30 bg-orange-tint/50 p-4">
          <p className="text-sm font-bold text-orange-700">{studentName} quiere avisar a su residencia que busca cambiar</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Como es menor de edad, el aviso se envía a {residenceName ?? "su residencia"} recién cuando lo confirmás. No ves su mensaje: es privado.
          </p>
          <div className="mt-3">
            <ConfirmByFamilyButton intentId={live.id} />
          </div>
        </div>
      )}

      {live && live.ui.key !== "pending_family" && (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">
            {studentName} avisó a {residenceName ?? "su residencia"} el {formatDateOnly(arDateOf(live.createdAt))} que busca otro lugar. Salida estimada:{" "}
            <strong className="text-ink">{live.estimatedExitDate ? formatDateOnly(live.estimatedExitDate) : "sin definir"}</strong>. Su reserva actual sigue
            vigente.
          </p>
          {live.response ? (
            <StayChangeResponse response={live.response} residenceName={residenceName ?? "la residencia"} variant="family" />
          ) : (
            <p className="rounded-field bg-cream-2 px-3.5 py-2.5 text-sm text-ink-soft">
              La residencia todavía no informó costos ni condiciones de salida. Te avisamos cuando responda.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/search" size="sm">
              Proponerle una residencia
            </Button>
            <Button href="/search" size="sm" variant="outline">
              Buscar residencias
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-ink-faint">
            La decisión es de {studentName}: vos podés proponerle opciones y ella o él decide si envía la solicitud. Solo {studentName} puede cancelar el aviso.
          </p>
        </>
      )}

      {resolved && (
        <div className="rounded-field bg-forest-tint p-4 text-sm leading-relaxed text-forest-700">
          <p className="font-bold">
            {studentName} confirmó una reserva en otra residencia{resolved.resolvedNewStartDate ? ` desde el ${formatDateOnly(resolved.resolvedNewStartDate)}` : ""}.
          </p>
          <p className="mt-1 text-ink-soft">{residenceName ?? "Su residencia actual"} registra su salida cuando se retire.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-field bg-mint p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-forest-700">Si {studentName} quiere cambiarse, no te enterás a último momento</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            El aviso da previsibilidad: ves cada novedad, los costos de salida por escrito y podés proponerle residencias. Sin promesas de lugar: toda solicitud
            está sujeta a confirmación.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="petrol">Te avisamos cada novedad</Badge>
            <Badge tone="petrol">Costos de salida por escrito</Badge>
            <Badge tone="petrol">Podés proponerle residencias</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
