"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";

/**
 * Teclado del celular en todos los formularios (decisión del dueño, 2026-11-27). Solo en pantallas táctiles:
 * la tecla Enter pasa al campo siguiente (en el último envía) y un botón «Siguiente» queda sobre el teclado, también en los
 * teclados numéricos (que no tienen Enter). El foco se mueve dentro del mismo gesto, así el teclado no se baja.
 * Se excluyen las búsquedas (`type="search"`, `role="search"`) y cualquier formulario con `data-no-keyboard-flow`.
 */
const FIELDS = "input, select, textarea";
const SKIPPED_TYPES = new Set(["hidden", "checkbox", "radio", "file", "submit", "button", "reset", "image", "range", "color"]);
/** Los que abren teclado: son los únicos que muestran el botón. */
const KEYBOARD_TYPES = new Set(["text", "email", "tel", "password", "number", "url"]);

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function usable(field: Field): boolean {
  if (field.disabled || field.tabIndex < 0) return false;
  if (field instanceof HTMLInputElement && (SKIPPED_TYPES.has(field.type) || field.readOnly)) return false;
  return field.getClientRects().length > 0 && !field.closest('[aria-hidden="true"], [inert]');
}

function flowForm(target: EventTarget | null): HTMLFormElement | null {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return null;
  if (target instanceof HTMLInputElement && target.type === "search") return null;
  const form = target.closest("form");
  if (!form || form.closest('[role="search"], [data-no-keyboard-flow]')) return null;
  return form;
}

function nextField(current: Field, form: HTMLFormElement): Field | null {
  const fields = Array.from(form.querySelectorAll<Field>(FIELDS));
  return fields.slice(fields.indexOf(current) + 1).find(usable) ?? null;
}

export function FormKeyboardFlow() {
  const [button, setButton] = useState<{ top: number; field: Field } | null>(null);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)");
    let current: Field | null = null;

    const place = () => {
      const form = current && flowForm(current);
      const typing = current instanceof HTMLTextAreaElement || (current instanceof HTMLInputElement && KEYBOARD_TYPES.has(current.type));
      if (!touch.matches || !current || !form || !typing || !nextField(current, form)) return setButton(null);
      const view = window.visualViewport;
      const bottom = view ? view.offsetTop + view.height : window.innerHeight;
      setButton({ top: bottom - 52, field: current });
    };

    const onFocus = (event: FocusEvent) => {
      const form = flowForm(event.target);
      current = form ? (event.target as Field) : null;
      if (touch.matches && form && current instanceof HTMLInputElement) {
        // Respeta lo que el formulario haya definido.
        if (!current.getAttribute("enterkeyhint")) current.enterKeyHint = nextField(current, form) ? "next" : "done";
      }
      place();
    };
    const onBlur = () => {
      current = null;
      // Un instante: si el foco pasa a otro campo, el botón no parpadea.
      setTimeout(() => {
        if (!current) setButton(null);
      }, 0);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!touch.matches || event.key !== "Enter" || event.isComposing || event.defaultPrevented) return;
      if (!(event.target instanceof HTMLInputElement) || SKIPPED_TYPES.has(event.target.type)) return;
      const form = flowForm(event.target);
      const next = form && nextField(event.target, form);
      if (!next || event.target.getAttribute("enterkeyhint") === "send") return;
      event.preventDefault();
      next.focus();
    };

    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKeyDown);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKeyDown);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, []);

  if (!button) return null;
  return createPortal(
    <button
      type="button"
      // Sin esto, tocar el botón le saca el foco al campo y el teclado se cierra.
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => {
        const form = button.field.closest("form");
        if (form) nextField(button.field, form)?.focus();
      }}
      style={{ top: button.top }}
      className="pointer-events-auto fixed right-2 z-[95] inline-flex min-h-11 items-center gap-1 rounded-full bg-forest-ink pl-4 pr-3 text-sm font-bold text-paper shadow-float focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink"
    >
      Siguiente
      <Icon name="arrow_forward" className="text-xl" />
    </button>,
    document.body,
  );
}
