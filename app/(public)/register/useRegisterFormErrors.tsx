"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { RegisterFormState } from "./formState";

/** Foco al primer campo inválido (o al aviso global) cuando llega un error nuevo. */
export function useFocusOnError(state: RegisterFormState) {
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? alertRef.current)?.focus();
  }, [state]);
  return { formRef, alertRef };
}

/** Props de accesibilidad y valor por defecto para un campo. */
export function fieldProps(
  state: RegisterFormState,
  name: string,
  idPrefix: string,
  fallback?: string,
  withDefault = true,
) {
  const error = state.fieldErrors?.[name];
  return {
    ...(withDefault ? { defaultValue: state.values?.[name] ?? fallback ?? "" } : {}),
    ...(error ? { "aria-invalid": true as const, "aria-describedby": `${idPrefix}-${name}-error` } : {}),
  };
}

/** `hint` del campo: si hay error lo reemplaza (con id para aria-describedby). */
export function fieldHint(state: RegisterFormState, name: string, idPrefix: string, hint?: ReactNode): ReactNode {
  const error = state.fieldErrors?.[name];
  if (!error) return hint;
  return (
    <span id={`${idPrefix}-${name}-error`} className="font-semibold text-danger-fg">
      {error}
    </span>
  );
}
