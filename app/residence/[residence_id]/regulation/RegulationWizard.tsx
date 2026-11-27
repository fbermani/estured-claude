"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { MODEL_ARTICLES, MODEL_VERSION } from "@/lib/regulations/modelTemplate";
import { useLocalDraft } from "@/components/forms/useLocalDraft";
import { DraftNotice } from "@/components/forms/DraftNotice";
import { draftStorageKey } from "@/lib/forms/localDraft";
import { REGULATION_WIZARD_DRAFT_SCOPE, sanitizeWizardDraft, type WizardDraftData } from "@/lib/regulations/draft";
import { assembleWizardText, baseArticleBody, wizardSections } from "@/lib/regulations/wizard";
import { fieldDef, fillFields, pendingFields } from "@/lib/regulations/fields";

/**
 * Asistente guiado del reglamento (DR18 fase 2, tanda 4). Un paso por sección del modelo de EstuRed: cada artículo se incluye o no y se
 * edita en voseo. Al final entrega el texto armado al editor, que lo publica por el flujo de siempre (no guarda nada por su cuenta).
 */
export function RegulationWizard({
  residenceName,
  draftScope,
  onFinish,
  onCancel,
}: {
  residenceName: string;
  /** Para guardar el avance en este dispositivo (borrador local). Sin esto el avance se pierde al cerrar. */
  draftScope?: { userId: string; residenceId: string };
  /** Devuelve true si el texto se aplicó al editor (se limpia el avance); false si espera una confirmación y el asistente sigue abierto. */
  onFinish: (text: string) => boolean;
  onCancel: () => void;
}) {
  const sections = useMemo(() => wizardSections(), []);
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(
      MODEL_ARTICLES.map((a) => [a.n, { included: a.tag === "suggested", body: baseArticleBody(a, residenceName) }]),
    ) as Record<number, { included: boolean; body: string }>,
  );
  // Valores de los campos `{...}` (opción múltiple, hora, número o texto). Se comparten entre artículos y se aplican al terminar.
  const [fields, setFields] = useState<Record<string, string>>({});
  // El avance (paso y artículos elegidos) queda en este dispositivo: se puede cerrar el asistente y retomarlo después.
  const draft = useLocalDraft<WizardDraftData>({
    storageKey: draftStorageKey(REGULATION_WIZARD_DRAFT_SCOPE, draftScope?.userId ?? "", draftScope?.residenceId ?? ""),
    enabled: draftScope !== undefined,
    stamp: MODEL_VERSION,
    value: { step, choices, fields },
    validate: (raw) =>
      sanitizeWizardDraft(
        raw,
        MODEL_ARTICLES.map((a) => a.n),
        sections.length,
      ),
    onRestore: (d) => {
      setStep(d.step);
      // Lo que falta en el borrador conserva el valor del modelo.
      setChoices((prev) => ({ ...prev, ...d.choices }));
      setFields(d.fields);
    },
  });
  const section = sections[step];
  const last = step === sections.length - 1;

  function update(n: number, patch: Partial<{ included: boolean; body: string }>) {
    setChoices((prev) => ({ ...prev, [n]: { ...prev[n], ...patch } }));
  }

  function finish() {
    const text = assembleWizardText(MODEL_ARTICLES.map((a) => ({ n: a.n, ...choices[a.n], body: fillFields(choices[a.n].body, fields) })));
    if (onFinish(text)) {
      draft.beginSave();
      draft.completeSave();
    }
  }

  return (
    <div className="space-y-4 rounded-card border border-sand-200 bg-sand-50 p-4" aria-label="Asistente del reglamento">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          Paso {step + 1} de {sections.length}: {section.name}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cerrar asistente
        </Button>
      </div>
      <DraftNotice
        notice={draft.notice}
        what="tu avance en el asistente"
        onDiscard={draft.discard}
        onAccept={draft.acceptStale}
        onDismiss={draft.dismissNotice}
      />
      <p className="text-xs text-ink-soft">
        Elegí qué artículos incluir y completá los campos de cada uno: elegí una opción, una hora o un número. Los marcados «sugerido» ordenan la convivencia;
        los opcionales los decidís vos. Lo que dejes sin completar queda entre llaves en el texto y tenés que resolverlo en el editor antes de publicar. Al terminar, el texto pasa al editor para que lo revises y lo publiques.
        Podés cerrar el asistente cuando quieras: tu avance queda guardado en este dispositivo.
      </p>
      <ul className="space-y-4">
        {section.articles.map((a) => {
          const c = choices[a.n];
          return (
            <li key={a.n} className="rounded-field bg-white p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={c.included} onChange={(e) => update(a.n, { included: e.target.checked })} />
                {a.title}
                <span className="text-xs font-normal text-ink-faint">{a.tag === "suggested" ? "sugerido" : "opcional"}</span>
              </label>
              {c.included && (
                <Textarea
                  id={`wiz-${a.n}`}
                  name={`wiz-${a.n}`}
                  label="Texto del artículo"
                  rows={4}
                  maxLength={2000}
                  value={c.body}
                  onChange={(e) => update(a.n, { body: e.target.value })}
                  className="mt-2 text-sm"
                />
              )}
              {c.included && pendingFields(c.body).length > 0 && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label={`Campos del artículo: ${a.title}`}>
                  {pendingFields(c.body).map((name) => {
                    const def = fieldDef(name);
                    const id = `wiz-${a.n}-${name}`;
                    const value = fields[name] ?? "";
                    const set = (v: string) => setFields((prev) => ({ ...prev, [name]: v }));
                    return def.kind === "select" ? (
                      <Select key={name} label={def.label} id={id} value={value} onChange={(e) => set(e.target.value)} keepLabelUp>
                        <option value="">Elegí una opción</option>
                        {def.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        key={name}
                        label={def.label}
                        keepLabelUp
                        id={id}
                        type={def.kind === "time" ? "time" : def.kind === "number" ? "number" : "text"}
                        min={def.kind === "number" ? 0 : undefined}
                        maxLength={200}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Anterior
        </Button>
        {last ? (
          <Button type="button" size="sm" onClick={finish}>
            Pasar al editor
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => setStep(step + 1)}>
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}
