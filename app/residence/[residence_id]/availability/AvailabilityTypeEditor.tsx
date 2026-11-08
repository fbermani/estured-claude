"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { saveTypeAvailabilityAction, type AvailabilityActionState } from "@/app/residence/[residence_id]/availability/actions";
import {
  GENDER_ROW_STATUSES,
  GENDER_ROW_STATUS_LABEL,
  MAX_GENDER_COUNT,
  MAX_GENDER_NOTE,
  genderRowTitle,
  type EditorRow,
  type GenderRowStatus,
} from "@/lib/availability/genderAvailability";

const initialState: AvailabilityActionState = { status: "idle" };

const fieldClasses =
  "w-full rounded-field border-[1.5px] border-field-border bg-cream px-3 py-2 text-base text-ink sm:text-sm placeholder:text-muted focus:border-forest focus:outline-2 focus:outline-forest-tint disabled:bg-cream-2 disabled:text-muted";

function summaryText(row: EditorRow): string | null {
  const s = row.summary;
  if (!s) return null;
  const parts = [
    `${s.freeBeds} ${s.freeBeds === 1 ? "cama libre" : "camas libres"} de ${s.beds}`,
    `${s.freeRooms} ${s.freeRooms === 1 ? "habitación libre entera" : "habitaciones libres enteras"}`,
  ];
  if (s.outOfServiceBeds > 0) parts.push(`${s.outOfServiceBeds} ${s.outOfServiceBeds === 1 ? "cama fuera de servicio" : "camas fuera de servicio"}`);
  return parts.join(" · ");
}

function GenderRowFields({
  row,
  typeName,
  legacy,
  roomsHref,
}: {
  row: EditorRow;
  typeName: string;
  legacy: boolean;
  roomsHref: string;
}) {
  const g = row.gender;
  const [status, setStatus] = useState<GenderRowStatus>(row.draft.status);
  const [count, setCount] = useState(row.draft.availableCount == null ? "" : String(row.draft.availableCount));
  const title = legacy ? `Todo el tipo «${typeName}»` : genderRowTitle(typeName, g);
  const summary = legacy ? null : summaryText(row);

  if (row.obsolete) {
    return (
      <div className="rounded-field border border-dashed border-line bg-cream-2/50 p-4">
        <p className="font-semibold text-ink-soft">{title}</p>
        <p className="mt-1 text-xs text-ink-faint">
          Ya no tenés habitaciones de este género en el tipo. Esta fila se quita sola al guardar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-field border border-sand-200 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">{title}</p>
          {summary && <p className="mt-0.5 text-xs text-ink-faint">{summary}</p>}
        </div>
        {!row.stored && !legacy && (
          <span className="rounded-full bg-amber-soft-100 px-2 py-0.5 text-xs font-semibold text-ink-soft">
            Sugerido: todavía no publicado
          </span>
        )}
      </div>

      {g === "sin_especificar" && !legacy && (
        <p className="mt-2 flex items-start gap-1.5 rounded-field bg-warning-bg px-3 py-2 text-xs text-warning-fg">
          <Icon name="info" className="mt-px text-sm" />
          <span>
            Estas habitaciones no tienen género definido, así que no se ofrecen por género.{" "}
            <Link href={roomsHref} className="font-semibold underline">
              Definilo en Habitaciones
            </Link>
            .
          </span>
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`status-${g}`} className="text-sm font-bold text-ink-soft">
            Estado
          </label>
          <select
            id={`status-${g}`}
            name={`status__${g}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as GenderRowStatus)}
            className={fieldClasses}
          >
            {GENDER_ROW_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GENDER_ROW_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`count-${g}`} className="text-sm font-bold text-ink-soft">
            Lugares disponibles
          </label>
          <input
            id={`count-${g}`}
            name={`count__${g}`}
            type="number"
            inputMode="numeric"
            enterKeyHint="next"
            min={0}
            max={MAX_GENDER_COUNT}
            value={status === "full" ? "0" : count}
            disabled={status === "full"}
            onChange={(e) => setCount(e.target.value)}
            className={fieldClasses}
          />
          {/* Un campo deshabilitado no se envía: con «Completa» el servidor fija la cantidad en 0. */}
          {!legacy && row.suggestedCount > 0 && status !== "full" && String(row.suggestedCount) !== count && (
            <button
              type="button"
              onClick={() => setCount(String(row.suggestedCount))}
              className="cursor-pointer self-start text-xs font-semibold text-forest-700 hover:underline"
            >
              Usar {row.suggestedCount} ({row.suggestedCount === 1 ? "cama libre" : "camas libres"} hoy)
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`from-${g}`} className="text-sm font-bold text-ink-soft">
            Disponible desde
          </label>
          <input
            id={`from-${g}`}
            name={`from__${g}`}
            type="date"
            defaultValue={row.draft.availableFrom ?? undefined}
            className={fieldClasses}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label htmlFor={`note-${g}`} className="text-sm font-bold text-ink-soft">
            Nota pública
          </label>
          <textarea
            id={`note-${g}`}
            name={`note__${g}`}
            rows={2}
            maxLength={MAX_GENDER_NOTE}
            defaultValue={row.draft.notesPublic ?? ""}
            className={fieldClasses}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Editor de disponibilidad de UN tipo, una fila por género. Todo se guarda junto (un solo botón): la residencia confirma o ajusta lo
 * sugerido a partir de sus camas libres. `legacy` = la migración 0075 no está aplicada: queda una sola fila para todo el tipo.
 */
export function AvailabilityTypeEditor({
  residenceId,
  roomTypeId,
  typeName,
  rows,
  legacy,
  roomsHref,
  driftNote,
}: {
  residenceId: string;
  roomTypeId: string;
  typeName: string;
  rows: EditorRow[];
  legacy: boolean;
  roomsHref: string;
  /** Aviso: el total del tipo se movió por una reserva o una salida desde la última carga por género. */
  driftNote?: string | null;
}) {
  const action = saveTypeAvailabilityAction.bind(null, residenceId, roomTypeId, legacy ? "legacy" : "genders");
  const [state, formAction, isPending] = useActionState(action, initialState);
  const anyUnsaved = rows.some((r) => !r.stored && !r.obsolete);

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-sand-200 pt-4">
      {driftNote && (
        <p className="flex items-start gap-1.5 rounded-field bg-info-bg px-3 py-2 text-xs text-info-fg">
          <Icon name="sync" className="mt-px text-sm" />
          <span>{driftNote}</span>
        </p>
      )}
      {rows.map((row) => (
        <GenderRowFields key={row.gender} row={row} typeName={typeName} legacy={legacy} roomsHref={roomsHref} />
      ))}

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <p className="text-sm font-medium text-forest-700">{state.message ?? "Disponibilidad actualizada."}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Guardando…" : anyUnsaved ? "Confirmar y publicar" : "Guardar disponibilidad"}
        </Button>
        {anyUnsaved && <p className="text-xs text-ink-faint">Los valores sugeridos salen de tus camas libres de hoy; ajustalos si hace falta.</p>}
      </div>
    </form>
  );
}
