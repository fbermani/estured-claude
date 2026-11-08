"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import { StayChangeSubmit } from "@/components/students/StayChangeSubmit";
import { StayChangeResponse } from "@/components/students/StayChangeResponse";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { formatUsd } from "@/lib/mock/exchange";
import { UNPAID_DISCLAIMER } from "@/lib/stayChange/copy";
import {
  STAY_CHANGE_TEMPLATE_KEYS,
  STAY_CHANGE_TEMPLATE_LABELS,
  buildInitialResponse,
  buildTemplate,
  hasPromissoryLanguage,
  minimumStayFulfilledOn,
  type StayChangeTemplateFields,
  type StayChangeTemplateKey,
} from "@/lib/stayChange/templates";
import { MAX_RESPONSE_FIELD, MIN_RESPONSE_MESSAGE } from "@/lib/stayChange/validate";
import type { ResidenceStayChangeItem } from "@/lib/stayChange/load";
import { tidyShortName } from "@/lib/stayChange/ui";
import { respondStayChangeIntentAction, type StayChangeResponseState } from "@/app/residence/[residence_id]/residents/stayChangeActions";

const initialState: StayChangeResponseState = { status: "idle" };

type Fields = { message: string; costs: string; usd: string; conditions: string; details: string };

function toFields(values: StayChangeTemplateFields): Fields {
  return {
    message: values.message,
    costs: values.exitCostsText,
    usd: values.exitCostsUsd != null ? String(values.exitCostsUsd) : "",
    conditions: values.exitConditionsText,
    details: values.exitDetailsText,
  };
}

function initialFor(item: ResidenceStayChangeItem): { fields: Fields; template: StayChangeTemplateKey | null } {
  if (item.response) {
    return {
      fields: {
        message: item.response.message ?? "",
        costs: item.response.exitCostsText ?? "",
        usd: item.response.exitCostsUsd != null ? String(item.response.exitCostsUsd) : "",
        conditions: item.response.exitConditionsText ?? "",
        details: item.response.exitDetailsText ?? "",
      },
      template: null,
    };
  }
  const initial = buildInitialResponse(item.templateContext);
  return { fields: toFields(initial), template: initial.suggestedTemplate };
}

/**
 * Hoja lateral "Responder a {nombre}" (SPEC §5.2): contexto de solo lectura, plantillas con datos reales de la estadía,
 * los 4 campos de la respuesta (precargados con la política de salida del perfil), guía de tono, vista previa "Ver como"
 * y envío. La respuesta es informativa: nunca promete lugar ni reembolsos. Validación real en el servidor.
 */
export function StayChangeResponseSheet({
  residenceId,
  residenceName,
  item,
  onClose,
  onSaved,
}: {
  residenceId: string;
  residenceName: string;
  item: ResidenceStayChangeItem;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const action = respondStayChangeIntentAction.bind(null, residenceId, item.id);
  const [state, formAction] = useActionState(action, initialState);
  const initial = useMemo(() => initialFor(item), [item]);
  const [fields, setFields] = useState<Fields>(initial.fields);
  const [template, setTemplate] = useState<StayChangeTemplateKey | null>(initial.template);
  const [dirty, setDirty] = useState(false);
  const [confirmTemplate, setConfirmTemplate] = useState<StayChangeTemplateKey | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const titleId = useId();
  const descId = useId();
  const studentLabel = tidyShortName(item.studentName);
  const firstName = item.templateContext.studentFirstName || studentLabel;
  const ctx = item.templateContext;
  const fulfilled = minimumStayFulfilledOn(ctx);
  const editing = !!item.response;
  const promissory = [fields.message, fields.costs, fields.conditions, fields.details].some(hasPromissoryLanguage);
  const messageTooShort = fields.message.trim().length > 0 && fields.message.trim().length < MIN_RESPONSE_MESSAGE;

  useEffect(() => {
    if (state.status === "saved") {
      onSaved(state.message ?? "Respuesta enviada.");
      onClose();
    }
  }, [state, onClose, onSaved]);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function applyTemplate(key: StayChangeTemplateKey) {
    setFields(toFields(buildTemplate(key, ctx)));
    setTemplate(key);
    setDirty(false);
    setConfirmTemplate(null);
  }

  function pickTemplate(key: StayChangeTemplateKey) {
    if (dirty && template !== key) setConfirmTemplate(key);
    else applyTemplate(key);
  }

  const contextRows: { label: string; value: string; warm?: boolean }[] = [
    { label: "Ingreso", value: ctx.stayStartDate ? formatDateOnly(ctx.stayStartDate) : "—" },
    { label: "Contrato hasta", value: item.contractEndDate ? formatDateOnly(item.contractEndDate) : "—" },
    {
      label: "Estadía mínima",
      value: ctx.minimumStayMonths ? `${ctx.minimumStayMonths} meses${fulfilled ? ` · se cumple el ${formatDateOnly(fulfilled)}` : ""}` : "No definida",
    },
    { label: "Depósito de la reserva", value: ctx.depositUsd != null ? formatUsd(ctx.depositUsd) : "Sin depósito" },
    { label: "Salida estimada", value: item.estimatedExitDate ? formatDateOnly(item.estimatedExitDate) : "Sin definir", warm: true },
  ];

  const previewResponse = {
    message: fields.message.trim() || null,
    exitCostsText: fields.costs.trim() || null,
    exitCostsUsd: fields.usd.trim() && Number.isFinite(Number(fields.usd)) ? Number(fields.usd) : null,
    exitConditionsText: fields.conditions.trim() || null,
    exitDetailsText: fields.details.trim() || null,
    respondedAt: new Date().toISOString(),
    edited: editing,
  };

  return (
    <Dialog open onClose={onClose} labelledBy={titleId} describedBy={descId} placement="side">
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">{previewing ? "Vista previa" : "Aviso de cambio"}</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-ink">
              {previewing ? `Así lo ve ${firstName}` : `${editing ? "Editar respuesta a" : "Responder a"} ${studentLabel}`}
            </h2>
            <p id={descId} className="mt-1 text-sm text-ink-soft">
              {previewing
                ? "Lo ve en Mi residencia junto con su familiar vinculado (sin su mensaje)."
                : "Contale costos, condiciones y detalles de la salida. Es informativo, no cambia el contrato."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cream-2 text-ink hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </header>

        {/* El formulario sigue montado en la vista previa para no perder lo escrito. */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${previewing ? "" : "space-y-5"}`}>
          {previewing && (
            <StayChangeResponse response={previewResponse} residenceName={residenceName} variant="preview" />
          )}
          <div className={previewing ? "hidden" : "space-y-5"}>
            {state.status === "error" && (
              <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                {state.message}
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-field border border-line bg-cream-2/50 p-4 text-sm">
              {contextRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs text-ink-faint">{row.label}</dt>
                  <dd className={`font-bold ${row.warm ? "text-orange-700" : "text-ink"}`}>{row.value}</dd>
                </div>
              ))}
              {item.studentMessage && (
                <div className="col-span-2 border-t border-line pt-3">
                  <dt className="text-xs text-ink-faint">Mensaje de {firstName}</dt>
                  <dd className="mt-0.5 text-sm italic leading-relaxed text-ink">“{item.studentMessage}”</dd>
                </div>
              )}
            </dl>

            <div>
              <p id="tpl-label" className="text-sm font-bold text-ink">
                Plantillas sugeridas
              </p>
              <div role="group" aria-labelledby="tpl-label" className="mt-2 flex flex-wrap gap-2">
                {STAY_CHANGE_TEMPLATE_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={template === key}
                    onClick={() => pickTemplate(key)}
                    className={`min-h-10 rounded-full border-[1.5px] px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                      template === key ? "border-forest bg-forest-tint text-forest-700" : "border-line-2 bg-paper text-ink-soft hover:border-forest"
                    }`}
                  >
                    {STAY_CHANGE_TEMPLATE_LABELS[key]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-faint">Completamos las fechas con los datos de la estadía. Revisá y editá antes de enviar.</p>
              {confirmTemplate && (
                <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-field bg-warning-bg px-3.5 py-2.5 text-xs text-warning-fg">
                  <span className="font-semibold">¿Reemplazar lo que escribiste?</span>
                  <button type="button" onClick={() => applyTemplate(confirmTemplate)} className="rounded-full bg-orange px-3 py-1 font-bold text-white">
                    Sí, reemplazar
                  </button>
                  <button type="button" onClick={() => setConfirmTemplate(null)} className="font-bold underline underline-offset-2">
                    Mantener lo mío
                  </button>
                </div>
              )}
            </div>

            <Textarea
              label={`Mensaje para ${firstName}`}
              name="message"
              rows={3}
              required
              maxLength={MAX_RESPONSE_FIELD}
              value={fields.message}
              onChange={(e) => set("message", e.target.value)}
              aria-invalid={messageTooShort}
              aria-describedby={messageTooShort ? "msg-error" : undefined}
              hint={`Obligatorio, mínimo ${MIN_RESPONSE_MESSAGE} caracteres.`}
            />
            {messageTooShort && (
              <p id="msg-error" className="-mt-3 text-xs font-semibold text-danger-fg">
                Escribí al menos {MIN_RESPONSE_MESSAGE} caracteres.
              </p>
            )}
            <Textarea
              label="Costos de salida anticipada"
              name="exit_costs_text"
              rows={3}
              maxLength={MAX_RESPONSE_FIELD}
              value={fields.costs}
              onChange={(e) => set("costs", e.target.value)}
            />
            <Input
              label="Monto de referencia (USD, opcional)"
              name="exit_costs_usd"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={fields.usd}
              onChange={(e) => set("usd", e.target.value)}
              hint="Solo informativo: EstuRed no lo cobra ni lo convierte en un pago."
            />
            <Textarea
              label="Condiciones"
              name="exit_conditions_text"
              rows={3}
              maxLength={MAX_RESPONSE_FIELD}
              value={fields.conditions}
              onChange={(e) => set("conditions", e.target.value)}
              hint="Depósito, estadía mínima, preaviso."
            />
            <Textarea
              label="Detalles de la salida"
              name="exit_details_text"
              rows={3}
              maxLength={MAX_RESPONSE_FIELD}
              value={fields.details}
              onChange={(e) => set("details", e.target.value)}
              hint="Fecha prevista, entrega de la habitación, llaves."
            />

            <div className="rounded-field bg-butter px-4 py-3 text-xs leading-relaxed text-butter-fg">
              <p>
                <strong>Escribí información, no promesas.</strong> Contá lo que aplica según lo que acordaron en la reserva. Evitá “te aseguramos”, “seguro hay
                lugar” o presiones para que se quede. {firstName} y su familiar vinculado lo leen tal cual.
              </p>
              {promissory && (
                <p role="status" className="mt-2 font-bold">
                  Tu texto tiene palabras que suenan a promesa (por ejemplo “garantizamos”, “aseguramos”). Revisalas antes de enviar.
                </p>
              )}
            </div>
            <p className="text-xs leading-relaxed text-ink-faint">{UNPAID_DISCLAIMER}</p>
          </div>
        </div>

        <footer className="shrink-0 space-y-3 border-t border-line bg-cream-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <p className="text-xs leading-relaxed text-ink-soft">
            Tu respuesta es informativa: EstuRed no fija ni cobra estos costos y no reemplaza el contrato con tu residente. Podés editarla mientras el aviso siga
            abierto.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setPreviewing((v) => !v)}>
              <Icon name={previewing ? "edit" : "visibility"} className="text-lg" />
              {previewing ? "Volver a editar" : `Ver como ${firstName}`}
            </Button>
            <StayChangeSubmit pendingLabel="Enviando…">{editing ? "Guardar cambios" : "Enviar respuesta"}</StayChangeSubmit>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
