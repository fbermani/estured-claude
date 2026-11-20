"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { publishRegulationAction, type PublishRegulationState } from "@/app/residence/[residence_id]/regulation/actions";
import { MAX_REGULATION_LENGTH } from "@/lib/regulations/limits";
import { RegulationWizard } from "@/app/residence/[residence_id]/regulation/RegulationWizard";
import { renderPlaceholders } from "@/lib/regulations/modelTemplate";
import { useLocalDraft } from "@/components/forms/useLocalDraft";
import { SaveStatus } from "@/components/forms/SaveStatus";
import { DraftNotice } from "@/components/forms/DraftNotice";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { draftStorageKey } from "@/lib/forms/localDraft";
import { REGULATION_DRAFT_SCOPE, sanitizeRegulationDraft, type RegulationDraftData } from "@/lib/regulations/draft";

const initialState: PublishRegulationState = { status: "idle" };

function PublishButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Publicando…" : "Publicar versión nueva"}
    </Button>
  );
}

/**
 * Editor del reglamento (DR14). Parte del texto vigente (o del modelo de EstuRed) y publica una versión nueva. `source` viaja en un
 * hidden: «model» mientras el texto salió del modelo, «own» si la residencia escribe el suyo. Controlado, para no perder lo escrito ante un error.
 */
export function RegulationEditor({
  residenceId,
  initialText,
  initialSource,
  modelText,
  canEdit,
  residenceName,
  draftScope,
}: {
  residenceId: string;
  initialText: string;
  initialSource: "own" | "model";
  modelText: string;
  canEdit: boolean;
  residenceName: string;
  /** Borrador local: quién edita y la huella de la versión vigente (su hash). Sin esto no se guarda borrador en el dispositivo. */
  draftScope?: { userId: string; stamp: string };
}) {
  const action = publishRegulationAction.bind(null, residenceId);
  const [state, formAction] = useActionState(action, initialState);
  const [text, setText] = useState(initialText);
  const [source, setSource] = useState<"own" | "model">(initialSource);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Reemplazo pendiente de confirmar (modelo o asistente): se aplica solo si la persona confirma.
  const [pendingReplace, setPendingReplace] = useState<{ text: string; kind: "model" | "wizard" } | null>(null);
  const unchanged = text.trim() === initialText.trim();

  // Borrador local (solo en este dispositivo): se guarda solo mientras se escribe y se recupera al volver. NO es una versión del
  // reglamento: no cuenta como aceptado ni vigente. Lo único que publica es «Publicar versión nueva».
  const draft = useLocalDraft<RegulationDraftData>({
    storageKey: draftStorageKey(REGULATION_DRAFT_SCOPE, draftScope?.userId ?? "", residenceId),
    enabled: canEdit && draftScope !== undefined,
    stamp: draftScope?.stamp ?? "",
    value: { text, source },
    validate: sanitizeRegulationDraft,
    onRestore: (d) => {
      setText(d.text);
      setSource(d.source);
    },
  });
  const { completeSave } = draft;
  const [publishedAt, setPublishedAt] = useState<number | null>(null);
  useEffect(() => {
    if (state.status !== "published") return;
    completeSave();
    setPublishedAt(Date.now());
  }, [state, completeSave]);

  function loadModel() {
    if (text.trim() !== initialText.trim()) {
      setPendingReplace({ text: modelText, kind: "model" });
      return;
    }
    setText(modelText);
    setSource("model");
  }

  function download() {
    const blob = new Blob([`Reglamento de convivencia - ${residenceName}\n\n${renderPlaceholders(text)}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reglamento.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function printable() {
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const blocks = renderPlaceholders(text).split(/\n{2,}/).filter((b) => b.trim());
    const html = blocks
      .map((b) => {
        const [first, ...rest] = b.split("\n");
        if (rest.length === 0 && first === first.toUpperCase()) return `<h2>${esc(first)}</h2>`;
        return `<p><strong>${esc(first)}</strong><br>${esc(rest.join("\n")).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reglamento - ${esc(residenceName)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:32px auto;padding:0 16px;line-height:1.5}h1{font-size:20px}h2{font-size:13px;letter-spacing:.1em;margin-top:24px}p{font-size:14px}</style></head><body><h1>Reglamento de convivencia - ${esc(residenceName)}</h1>${html}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <form
      action={(fd) => {
        draft.beginSave();
        formAction(fd);
      }}
      className="space-y-4"
    >
      <DraftNotice
        notice={draft.notice}
        what="tu borrador del reglamento"
        onDiscard={draft.discard}
        onAccept={draft.acceptStale}
        onDismiss={draft.dismissNotice}
      />
      <UnsavedChangesGuard
        active={draft.dirty && draft.localState === "unavailable"}
        description="Este navegador no permite guardar borradores, así que lo que escribiste se pierde si salís. Publicalo o copiá el texto antes de irte."
      />
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={loadModel} disabled={!canEdit}>
          Partir del modelo de EstuRed
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSource("own")} disabled={!canEdit || source === "own"}>
          Es un reglamento propio
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setWizardOpen(true)} disabled={!canEdit}>
          Armarlo paso a paso
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={download} disabled={text.trim().length === 0}>
          Descargar (.txt)
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={printable} disabled={text.trim().length === 0}>
          Imprimir / guardar como PDF
        </Button>
        <span className="text-xs text-ink-faint">
          {source === "model"
            ? "Basado en el modelo: completá los campos entre llaves y borrá lo que no aplique."
            : "Reglamento propio de la residencia."}
        </span>
      </div>
      {wizardOpen && (
        <RegulationWizard
          residenceName={residenceName}
          draftScope={draftScope && canEdit ? { userId: draftScope.userId, residenceId } : undefined}
          onCancel={() => setWizardOpen(false)}
          onFinish={(t) => {
            // Con un reglamento propio ya escrito se pide confirmar antes de reemplazarlo; el asistente sigue abierto (y con su avance) hasta entonces.
            if (text.trim() !== "" && source === "own") {
              setPendingReplace({ text: t, kind: "wizard" });
              return false;
            }
            setWizardOpen(false);
            setText(t);
            setSource("model");
            return true;
          }}
        />
      )}
      <ConfirmDialog
        open={pendingReplace !== null}
        title={pendingReplace?.kind === "wizard" ? "¿Reemplazar tu reglamento?" : "¿Reemplazar lo que escribiste?"}
        description={
          pendingReplace?.kind === "wizard"
            ? "Vas a reemplazar tu reglamento por el que armaste con el asistente."
            : "Vas a reemplazar lo que escribiste por el modelo de EstuRed."
        }
        confirmLabel="Reemplazar"
        cancelLabel="Mantener el mío"
        onCancel={() => setPendingReplace(null)}
        onConfirm={() => {
          if (pendingReplace) {
            setText(pendingReplace.text);
            setSource("model");
            if (pendingReplace.kind === "wizard") setWizardOpen(false);
          }
          setPendingReplace(null);
        }}
      />
      <Textarea
        id="regulation-text"
        name="text"
        label="Texto del reglamento"
        rows={24}
        maxLength={MAX_REGULATION_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!canEdit}
        hint={`${text.length.toLocaleString("es-AR")}/${MAX_REGULATION_LENGTH.toLocaleString("es-AR")} caracteres. Texto plano: una línea en mayúsculas es un título de sección y «Art. N.» abre un artículo.`}
        className="font-mono text-sm"
      />
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "published" && (
        <p role="status" className="rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          {state.message}
        </p>
      )}
      <SaveStatus
        dirty={draft.dirty}
        localState={draft.localState}
        localSavedAt={draft.savedAt}
        accountSavedAt={publishedAt}
        accountLabel="Publicado"
      />
      <div className="flex flex-wrap items-center gap-3">
        <PublishButton disabled={!canEdit || unchanged} />
        <Button type="button" variant="outline" size="sm" onClick={draft.saveNow} disabled={!canEdit || !draft.dirty}>
          Guardar borrador
        </Button>
        <p className="text-xs text-ink-faint">Los cambios rigen para solicitudes nuevas; las que ya aceptaron una versión anterior conservan esa versión.</p>
      </div>
      <p className="text-xs text-ink-soft">
        El borrador queda guardado en este dispositivo, no se publica y no cambia lo que ven quienes mandan una solicitud. Podés volver a la configuración y seguir más tarde.
      </p>
    </form>
  );
}
