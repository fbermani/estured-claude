"use client";

import { useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { resetShareMessageAction, saveShareMessageAction } from "@/app/residence/[residence_id]/share/actions";
import {
  SHARE_PLACEHOLDERS,
  SHARE_TEMPLATE_MAX,
  buildWhatsappShareUrl,
  resolveShareMessage,
  validateShareTemplate,
  type SharePlaceholderKey,
} from "@/lib/share/resolveShareMessage";

/** Marcas (control chars que no existen en la plantilla) para resaltar en la vista previa lo que se completó solo. */
const OPEN = "\u0001";
const CLOSE = "\u0002";

/** Parte el texto con marcas en tramos: los resaltados (datos completados solos) y el resto. */
function splitMarked(text: string): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  let rest = text;
  while (rest.length > 0) {
    const open = rest.indexOf(OPEN);
    if (open === -1) {
      parts.push({ text: rest, hit: false });
      break;
    }
    const close = rest.indexOf(CLOSE, open + 1);
    if (close === -1) {
      parts.push({ text: rest.replace(OPEN, ""), hit: false });
      break;
    }
    if (open > 0) parts.push({ text: rest.slice(0, open), hit: false });
    parts.push({ text: rest.slice(open + 1, close), hit: true });
    rest = rest.slice(close + 1);
  }
  return parts;
}

type Feedback = { tone: "success" | "error"; text: string } | null;

/**
 * Editor y vista previa del mensaje de WhatsApp con el que la residencia comparte su ficha. Lo usan la página del panel
 * (`/residence/[id]/share`) y la hoja «Compartir esta ficha» (`ShareFichaSheet`).
 *
 * Con `canEdit` (permiso `profile.edit`) la persona edita la plantilla cruda con chips que insertan `{DATO}` en el cursor, ve el texto ya
 * resuelto con los datos reales de su residencia y guarda o restablece el original. Sin permiso solo VE el mensaje y lo comparte
 * («Abrir WhatsApp» y «Copiar»). «Abrir WhatsApp» es un enlace manual `wa.me`: nunca la API de WhatsApp Business. La validación que vale
 * es la del servidor; acá se repite (misma función pura) solo para avisar a tiempo.
 */
export function ShareMessageEditor({
  residenceId,
  initialTemplate,
  defaultTemplate,
  initialIsCustom,
  values,
  link,
  canEdit,
  schemaReady,
  previewImageUrl,
  changeCoverHref,
  stacked = false,
}: {
  residenceId: string;
  /** Plantilla vigente (la guardada o la original). */
  initialTemplate: string;
  defaultTemplate: string;
  initialIsCustom: boolean;
  /** Valor de cada dato de la residencia; `null` = falta (esa línea se omite). */
  values: Record<SharePlaceholderKey, string | null>;
  link: string;
  canEdit: boolean;
  /** Falso cuando la tabla todavía no existe en este entorno: se comparte, pero no se guarda. */
  schemaReady: boolean;
  /** Imagen de vista previa del link (solo residencias publicadas). */
  previewImageUrl?: string | null;
  /** Enlace a «Cambiar portada» (editor de fotos del perfil). */
  changeCoverHref?: string | null;
  /** Una sola columna (editor arriba, vista previa abajo): para la hoja lateral, que es angosta. */
  stacked?: boolean;
}) {
  const textareaId = useId();
  const hintId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [template, setTemplate] = useState(initialTemplate);
  const [savedTemplate, setSavedTemplate] = useState(initialTemplate);
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, startTransition] = useTransition();

  // Quien no edita ve el mensaje guardado; quien edita, el borrador (cambia mientras escribe).
  const shown = canEdit ? template : savedTemplate;
  const resolved = useMemo(() => resolveShareMessage(shown, values), [shown, values]);
  const validation = useMemo(() => validateShareTemplate(shown, { resolvedLength: resolved.length }), [shown, resolved]);
  const dirty = canEdit && template.trim() !== savedTemplate.trim();
  const overLimit = resolved.length > SHARE_TEMPLATE_MAX;

  const marked = useMemo(() => {
    const wrapped = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ? `${OPEN}${v}${CLOSE}` : v])) as Record<SharePlaceholderKey, string | null>;
    return resolveShareMessage(shown, wrapped);
  }, [shown, values]);
  const previewParts = useMemo(() => splitMarked(marked), [marked]);

  const status = dirty ? "Cambios sin guardar" : isCustom ? "Usando tu mensaje guardado" : "Usando el mensaje original";

  function insertPlaceholder(key: SharePlaceholderKey) {
    const token = `{${key}}`;
    const el = textareaRef.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    const next = `${template.slice(0, start)}${token}${template.slice(end)}`;
    setTemplate(next);
    setFeedback(null);
    // El cursor queda después del dato insertado.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveShareMessageAction(residenceId, template);
      if (result.status === "success") {
        setSavedTemplate(result.template);
        setTemplate(result.template);
        setIsCustom(result.template.trim() !== defaultTemplate.trim());
        setFeedback({ tone: "success", text: "Guardamos tu mensaje. Es el que vas a compartir desde ahora." });
      } else {
        setFeedback({ tone: "error", text: result.message });
      }
    });
  }

  function reset() {
    setConfirmReset(false);
    setFeedback(null);
    startTransition(async () => {
      const result = await resetShareMessageAction(residenceId);
      if (result.status === "success") {
        setSavedTemplate(result.template);
        setTemplate(result.template);
        setIsCustom(false);
        setFeedback({ tone: "success", text: "Volviste al mensaje original." });
      } else {
        setFeedback({ tone: "error", text: result.message });
      }
    });
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ tone: "success", text: `Copiamos ${what}.` });
    } catch {
      setFeedback({ tone: "error", text: `No pudimos copiar ${what}. Seleccionalo en la vista previa y copialo a mano.` });
    }
  }

  const canShare = validation.ok && resolved.length > 0;
  const outlineBtn =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-line-2 bg-paper px-5 text-sm font-bold text-ink transition hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:pointer-events-none disabled:opacity-50";
  const waBtn = `${outlineBtn} ${canEdit ? "" : "!border-forest !bg-forest !text-white hover:!bg-forest-600"}`;

  const preview: ReactNode = (
    <section aria-labelledby={`${textareaId}-prev`} className="rounded-card border-[1.5px] border-line bg-paper p-5">
      <h3 id={`${textareaId}-prev`} className="text-base font-bold text-ink">
        Así lo va a recibir
      </h3>
      {resolved ? (
        <p className="mt-3 whitespace-pre-line break-words rounded-field bg-cream-2 px-4 py-3 text-sm leading-relaxed text-ink">
          {previewParts.map((part, i) =>
            part.hit ? (
              <mark key={i} className="rounded-sm bg-forest-tint px-0.5 font-semibold text-forest-700">
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      ) : (
        <p className="mt-3 rounded-field bg-cream-2 px-4 py-3 text-sm text-ink-soft">Cuando escribas el mensaje, lo ves acá.</p>
      )}
      <p className="mt-2 text-xs text-ink-faint">
        Los datos resaltados se completan solos con lo que cargaste en tu ficha. El precio en pesos es una referencia: el importe final lo confirma
        la residencia.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canShare ? (
          <a href={buildWhatsappShareUrl(resolved)} target="_blank" rel="noopener noreferrer" className={waBtn}>
            <Icon name="share" className="text-lg" />
            Abrir WhatsApp con el mensaje
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        ) : (
          <button type="button" disabled className={waBtn} title="Corregí el mensaje para poder compartirlo">
            <Icon name="share" className="text-lg" />
            Abrir WhatsApp con el mensaje
          </button>
        )}
        <button type="button" disabled={!canShare} onClick={() => void copy(resolved, "el mensaje")} className={outlineBtn}>
          <Icon name="content_copy" className="text-lg" />
          Copiar mensaje
        </button>
        <button type="button" onClick={() => void copy(link, "el link")} className={outlineBtn}>
          <Icon name="link" className="text-lg" />
          Copiar link
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-faint">Se abre WhatsApp en tu dispositivo con el texto listo: vos elegís a quién enviarlo.</p>
      {previewImageUrl && (
        <figure className="mt-5">
          <Image
            src={previewImageUrl}
            alt="Así se ve el link de tu ficha en WhatsApp: tu portada, el nombre de la residencia y el precio desde"
            width={1200}
            height={630}
            unoptimized
            className="h-auto w-full rounded-field border-[1.5px] border-line"
          />
          <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
            <span>Vista previa del link.</span>
            {changeCoverHref && (
              <Link href={changeCoverHref} className="font-semibold text-forest-700 underline underline-offset-2">
                Cambiar portada
              </Link>
            )}
          </figcaption>
        </figure>
      )}
    </section>
  );

  return (
    <div className="mt-6">
      <div className={canEdit && !stacked ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
        {canEdit && (
          <section aria-labelledby={`${textareaId}-ed`} className="rounded-card border-[1.5px] border-line bg-paper p-5">
            <h3 id={`${textareaId}-ed`} className="text-base font-bold text-ink">
              Tu mensaje
            </h3>
            <p className="mt-1 text-sm text-ink-soft">Escribilo como si lo mandaras vos. Tocá un dato para sumarlo donde tenés el cursor.</p>
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Datos que se completan solos</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {SHARE_PLACEHOLDERS.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder(p.key)}
                      title={p.description}
                      className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-dashed border-line-2 bg-paper px-3 text-sm font-semibold text-ink transition hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                    >
                      {p.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <label htmlFor={textareaId} className="mt-4 block text-sm font-semibold text-ink">
              Mensaje
            </label>
            <textarea
              id={textareaId}
              ref={textareaRef}
              value={template}
              rows={12}
              onChange={(e) => {
                setTemplate(e.target.value);
                setFeedback(null);
              }}
              aria-describedby={hintId}
              aria-invalid={!validation.ok}
              spellCheck
              className="mt-1 w-full rounded-field border-[1.5px] border-line-2 bg-paper px-4 py-3 font-mono text-sm leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
            />
            <p id={hintId} className={`mt-1 text-xs tabular-nums ${overLimit ? "font-bold text-danger-fg" : "text-ink-faint"}`}>
              {resolved.length.toLocaleString("es-AR")} caracteres (máx. {SHARE_TEMPLATE_MAX.toLocaleString("es-AR")}) en el mensaje ya armado.
            </p>
            {!validation.ok && (
              <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                {validation.error}
              </p>
            )}
            {!schemaReady && (
              <p role="status" className="mt-3 rounded-field bg-warning-bg px-4 py-3 text-sm text-warning-fg">
                Guardar tu propio mensaje todavía no está disponible en este entorno. Podés compartir el mensaje igual.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" size="sm" onClick={save} disabled={pending || !dirty || !validation.ok || !schemaReady}>
                {pending ? "Guardando…" : "Guardar mensaje"}
              </Button>
              {isCustom && (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  disabled={pending}
                  className="rounded-field px-1 text-sm font-semibold text-forest-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50"
                >
                  Restablecer el original
                </button>
              )}
              <span className={`text-sm font-semibold ${dirty ? "text-warning-fg" : "text-ink-soft"}`}>{status}</span>
            </div>
          </section>
        )}
        {preview}
      </div>
      <p role="status" aria-live="polite" className={feedback ? `mt-4 rounded-field px-4 py-3 text-sm font-medium ${feedback.tone === "success" ? "bg-mint text-forest-700" : "bg-danger-bg text-danger-fg"}` : "sr-only"}>
        {feedback?.text ?? ""}
      </p>
      <ConfirmDialog
        open={confirmReset}
        title="¿Volver al mensaje original?"
        description="Se borra tu mensaje guardado y vas a compartir el original de EstuRed. Podés volver a escribir el tuyo cuando quieras."
        confirmLabel="Sí, restablecer"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
