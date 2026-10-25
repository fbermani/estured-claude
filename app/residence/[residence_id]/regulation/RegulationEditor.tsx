"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { publishRegulationAction, type PublishRegulationState } from "@/app/residence/[residence_id]/regulation/actions";
import { MAX_REGULATION_LENGTH } from "@/lib/regulations/limits";

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
}: {
  residenceId: string;
  initialText: string;
  initialSource: "own" | "model";
  modelText: string;
  canEdit: boolean;
}) {
  const action = publishRegulationAction.bind(null, residenceId);
  const [state, formAction] = useActionState(action, initialState);
  const [text, setText] = useState(initialText);
  const [source, setSource] = useState<"own" | "model">(initialSource);
  const unchanged = text.trim() === initialText.trim();

  function loadModel() {
    if (text.trim() !== initialText.trim() && !window.confirm("Vas a reemplazar lo que escribiste por el modelo de EstuRed. ¿Seguimos?")) return;
    setText(modelText);
    setSource("model");
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="source" value={source} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={loadModel} disabled={!canEdit}>
          Partir del modelo de EstuRed
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSource("own")} disabled={!canEdit || source === "own"}>
          Es un reglamento propio
        </Button>
        <span className="text-xs text-ink-faint">
          {source === "model"
            ? "Basado en el modelo: completá los campos entre llaves y borrá lo que no aplique."
            : "Reglamento propio de la residencia."}
        </span>
      </div>
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
      <div className="flex flex-wrap items-center gap-3">
        <PublishButton disabled={!canEdit || unchanged} />
        <p className="text-xs text-ink-faint">Los cambios rigen para solicitudes nuevas; las que ya aceptaron una versión anterior conservan esa versión.</p>
      </div>
    </form>
  );
}
