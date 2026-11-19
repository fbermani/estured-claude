"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { MODEL_ARTICLES, MODEL_VERSION } from "@/lib/regulations/modelTemplate";
import { useLocalDraft } from "@/components/forms/useLocalDraft";
import { DraftNotice } from "@/components/forms/DraftNotice";
import { draftStorageKey } from "@/lib/forms/localDraft";
import { REGULATION_WIZARD_DRAFT_SCOPE, sanitizeWizardDraft, type WizardDraftData } from "@/lib/regulations/draft";
import { assembleWizardText, baseArticleBody, wizardSections } from "@/lib/regulations/wizard";

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
  onFinish: (text: string) => void;
  onCancel: () => void;
}) {
  const sections = useMemo(() => wizardSections(), []);
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState(() =>
    Object.fromEntries(
      MODEL_ARTICLES.map((a) => [a.n, { included: a.tag === "suggested", body: baseArticleBody(a, residenceName) }]),
    ) as Record<number, { included: boolean; body: string }>,
  );
  // El avance (paso y artículos elegidos) queda en este dispositivo: se puede cerrar el asistente y retomarlo después.
  const draft = useLocalDraft<WizardDraftData>({
    storageKey: draftStorageKey(REGULATION_WIZARD_DRAFT_SCOPE, draftScope?.userId ?? "", draftScope?.residenceId ?? ""),
    enabled: draftScope !== undefined,
    stamp: MODEL_VERSION,
    value: { step, choices },
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
    },
  });
  const section = sections[step];
  const last = step === sections.length - 1;

  function update(n: number, patch: Partial<{ included: boolean; body: string }>) {
    setChoices((prev) => ({ ...prev, [n]: { ...prev[n], ...patch } }));
  }

  function finish() {
    const text = assembleWizardText(MODEL_ARTICLES.map((a) => ({ n: a.n, ...choices[a.n] })));
    draft.beginSave();
    draft.completeSave();
    onFinish(text);
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
        Elegí qué artículos incluir y completá los campos entre llaves (por ejemplo {"{hora_silencio}"}). Los marcados «sugerido» ordenan la convivencia;
        los opcionales los decidís vos. Al terminar, el texto pasa al editor para que lo revises y lo publiques.
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
