"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

/**
 * Piezas compartidas de los formularios de preapertura (paso 1, paso 2 y registro familiar). Todas usan los tokens FRESH y los
 * componentes existentes (`Button`, `Input`, `Icon`); nada de colores ni tipografías literales.
 */

/** Errores por campo: `name` -> mensaje. Los mensajes los pone el servidor. */
export type FieldErrors = Record<string, string> | undefined;

/** Atributos de accesibilidad de un campo con error. */
export function errorProps(errors: FieldErrors, name: string, prefix: string) {
  return errors?.[name]
    ? ({ "aria-invalid": true as const, "aria-describedby": `${prefix}-${name}-error` })
    : ({} as Record<string, never>);
}

/** Texto del campo: el error (con ícono, no solo color) reemplaza a la ayuda. */
export function errorHint(errors: FieldErrors, name: string, prefix: string, hint?: ReactNode): ReactNode {
  const error = errors?.[name];
  if (!error) return hint;
  return (
    <span id={`${prefix}-${name}-error`} className="flex items-start gap-1.5 text-sm font-semibold text-danger-fg">
      <Icon name="error" className="text-lg" />
      <span>{error}</span>
    </span>
  );
}

/** Al llegar un error nuevo, el foco va al primer campo inválido o, si no hay, al aviso. */
export function useFocusOnError(trigger: unknown, active: boolean): { formRef: RefObject<HTMLFormElement | null>; alertRef: RefObject<HTMLDivElement | null> } {
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? alertRef.current)?.focus();
  }, [trigger, active]);
  return { formRef, alertRef };
}

type Tone = "danger" | "info" | "ok";
const TONES: Record<Tone, string> = {
  danger: "border-danger-fg bg-danger-bg text-danger-fg",
  info: "border-info-fg bg-info-bg text-info-fg",
  ok: "border-success-fg bg-success-bg text-success-fg",
};

/** Aviso del formulario: `role="alert"` (errores) o `role="status"` (informativos). Borde lateral + ícono, no solo color. */
export const FormAlert = function FormAlert({
  tone = "danger",
  icon = "error",
  title,
  children,
  alertRef,
  className = "",
}: {
  tone?: Tone;
  icon?: string;
  title: string;
  children?: ReactNode;
  alertRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div
      ref={alertRef}
      tabIndex={-1}
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-field border-l-4 px-3.5 py-3 text-sm focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink ${TONES[tone]} ${className}`}
    >
      <Icon name={icon} className="mt-px text-xl" />
      <div>
        <p className="font-bold">{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
    </div>
  );
};

/** Contraseña con botón de mostrar/ocultar (44 px). Controlado: el valor no se pierde si el servidor devuelve un error. */
export function PasswordField({
  value,
  onChange,
  error,
  errorId,
  hint,
  id = "pre-password",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  errorId?: string;
  hint?: ReactNode;
  id?: string;
}) {
  const [visible, setVisible] = useState(false);
  const shownHint = error ? (
    <span id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-danger-fg">
      <Icon name="error" className="text-lg" />
      <span>{error}</span>
    </span>
  ) : (
    hint
  );
  return (
    <div className="relative">
      <Input
        id={id}
        name="password"
        label="Contraseña"
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? `${id}-hint`}
        hint={shownHint ?? <span id={`${id}-hint`} />}
        className="pr-14 aria-invalid:border-danger-fg"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-1 top-[26px] grid size-11 place-items-center rounded-field text-ink-soft hover:text-ink focus-visible:outline-[3px] focus-visible:outline-offset-0 focus-visible:outline-forest-ink"
      >
        <Icon name={visible ? "visibility_off" : "visibility"} className="text-2xl" />
      </button>
    </div>
  );
}

/** Botón de envío del formulario: `aria-disabled` mientras envía (el foco no se pierde) y spinner con el texto de estado. */
export function SubmitButton({ idle, pending, isPending, block = true, className = "" }: { idle: ReactNode; pending: string; isPending: boolean; block?: boolean; className?: string }) {
  return (
    <Button
      type="submit"
      variant="secondary"
      size="lg"
      aria-disabled={isPending}
      onClick={(event) => {
        if (isPending) event.preventDefault();
      }}
      className={`${block ? "w-full " : ""}shadow-orange ${className}`}
    >
      {isPending ? (
        <>
          <span aria-hidden="true" className="size-[18px] animate-spin rounded-full border-[2.5px] border-white/45 border-t-white motion-reduce:animate-none" />
          {pending}
        </>
      ) : (
        idle
      )}
    </Button>
  );
}

/** Casillero de una línea: la fila entera se resalta con el foco del teclado. */
export function CheckRow({
  name,
  checked,
  onChange,
  disabled,
  describedBy,
  invalid,
  children,
  className = "",
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-field text-sm text-ink-soft has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest-ink ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      } ${className}`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-[22px] shrink-0 accent-forest"
      />
      <span>{children}</span>
    </label>
  );
}

/** Copia al portapapeles un link relativo del sitio (se arma con el origen real del navegador). */
export function CopyLinkButton({
  path,
  label,
  copiedLabel,
  variant = "outline",
  className = "",
}: {
  path: string;
  label: string;
  copiedLabel: string;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("failed");
    }
  }
  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={copy} className={className}>
        <Icon name={state === "copied" ? "check" : "link"} className="text-xl" />
        {state === "copied" ? copiedLabel : label}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? copiedLabel : state === "failed" ? "No pudimos copiar el link. Copialo a mano desde la barra del navegador." : ""}
      </span>
      {state === "failed" && <span className="text-sm text-danger-fg">No pudimos copiarlo. Probá de nuevo.</span>}
    </>
  );
}

/** Los dos puntos de «Paso N de 2». */
export function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <span aria-hidden="true" className="flex gap-1.5">
      <i className={`h-1.5 w-[22px] rounded-full ${step === 1 ? "bg-orange" : "bg-forest"}`} />
      <i className={`h-1.5 w-[22px] rounded-full ${step === 2 ? "bg-orange" : "bg-cream-2"}`} />
    </span>
  );
}

/** Aviso para quien ya tiene sesión y llega a un formulario de registro. */
export function AlreadyIn({ titleId = "pre-signup-title" }: { titleId?: string }) {
  return (
    <div className="p-5 @min-[640px]:px-9 @min-[640px]:py-8">
      <h1 id={titleId} className="font-display text-3xl leading-tight tracking-tight text-ink">
        Ya estás adentro
      </h1>
      <p className="mt-3 text-ink-soft">Ya tenés una cuenta iniciada. Si querés registrar a otra persona, primero salí desde «Mi lugar».</p>
      <Button href="/mi-lugar" variant="secondary" size="lg" className="mt-5 w-full shadow-orange">
        Ir a Mi lugar
      </Button>
    </div>
  );
}
