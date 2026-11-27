import { useId, type ComponentPropsWithoutRef } from "react";

/**
 * Campos de la app (decisión del dueño, 2026-11-27). Con `label`, el título va DENTRO del campo y al enfocar o completar queda
 * chico arriba (`.field-float` en `app/fields.css`). Alto 56 px. El teclado del celular se deduce del `type` (y de `inputMode`
 * cuando un texto lleva números). El salto al campo siguiente lo hace `components/ui/FormKeyboardFlow.tsx`.
 */
const fieldClasses =
  "w-full rounded-field border-[1.5px] border-field-border bg-cream px-3.5 text-base text-ink placeholder:text-muted transition-colors duration-200 ease-fresh focus:border-forest focus:outline-2 focus:outline-forest-tint aria-invalid:border-danger-fg read-only:bg-cream-2 disabled:bg-cream-2 disabled:text-muted";

/** Tipos que el navegador siempre dibuja con contenido propio: el título queda arriba desde el inicio. */
const ALWAYS_FILLED = new Set(["date", "time", "datetime-local", "month", "week", "file", "color", "range"]);

/** Clases de ubicación (margen, flex, grilla): van en el contenedor, no en el control, para no separar el título del campo. */
const LAYOUT_CLASS = /^(?:[a-z0-9@[\]-]+:)*(?:-?m[trblxy]?-|flex-1$|flex-none$|grow|shrink|basis-|col-span-|row-span-|self-|order-)/;

function splitClasses(className = ""): { layout: string; control: string } {
  const layout: string[] = [];
  const control: string[] = [];
  for (const token of className.split(/\s+/).filter(Boolean)) (LAYOUT_CLASS.test(token) ? layout : control).push(token);
  return { layout: layout.join(" "), control: control.join(" ") };
}

interface FieldWrapperProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
}

function FieldWrapper({
  label,
  hint,
  id,
  className,
  staticLabel,
  children,
}: FieldWrapperProps & { className?: string; staticLabel?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      {label ? (
        // El control va antes que el título: el estado del título se resuelve con selectores de hermano.
        <div className="field-float" data-static={staticLabel ? "" : undefined}>
          {children}
          <label htmlFor={id}>{label}</label>
        </div>
      ) : (
        children
      )}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Teclado según el tipo; lo que venga explícito en el campo manda. */
function keyboardProps(props: ComponentPropsWithoutRef<"input">): Partial<ComponentPropsWithoutRef<"input">> {
  const { type, step, autoComplete } = props;
  if (type === "email") return { inputMode: "email", autoCapitalize: "none", spellCheck: false };
  if (type === "tel") return { inputMode: "tel" };
  if (type === "url") return { inputMode: "url", autoCapitalize: "none", spellCheck: false };
  if (type === "search") return { inputMode: "search" };
  if (type === "number") {
    // Importes y cotizaciones aceptan decimales aunque no declaren `step`.
    const decimals = step === "any" || String(step ?? "").includes(".") || /amount|usd|ars|rate|price/i.test(props.name ?? "");
    return { inputMode: decimals ? "decimal" : "numeric" };
  }
  if (autoComplete && /(^| )(name|given-name|family-name|street-address)$/.test(autoComplete)) return { autoCapitalize: "words" };
  return {};
}

export function Input({
  label,
  hint,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "id"> & FieldWrapperProps) {
  // Sin `id` explícito el <label> quedaba sin asociar al campo (H31): se genera uno.
  const autoId = useId();
  const id = props.id ?? autoId;
  const { layout, control } = splitClasses(className);
  return (
    <FieldWrapper label={label} hint={hint} id={id} className={layout} staticLabel={ALWAYS_FILLED.has(props.type ?? "text")}>
      <input
        {...keyboardProps(props)}
        {...props}
        // `placeholder` siempre presente: `:placeholder-shown` es lo que dice si el campo está vacío.
        placeholder={props.placeholder ?? (label ? " " : undefined)}
        id={id}
        className={`${fieldClasses} h-14 ${control}`}
      />
    </FieldWrapper>
  );
}

export function Textarea({
  label,
  hint,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"textarea">, "id"> & FieldWrapperProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  const { layout, control } = splitClasses(className);
  return (
    <FieldWrapper label={label} hint={hint} id={id} className={layout}>
      <textarea
        rows={4}
        {...props}
        placeholder={props.placeholder ?? (label ? " " : undefined)}
        id={id}
        className={`${fieldClasses} min-h-24 py-3 ${control}`}
      />
    </FieldWrapper>
  );
}

export function Select({
  label,
  hint,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"select">, "id"> & FieldWrapperProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  const { layout, control } = splitClasses(className);
  return (
    <FieldWrapper label={label} hint={hint} id={id} className={layout}>
      <select {...props} id={id} className={`${fieldClasses} h-14 ${control}`}>
        {children}
      </select>
    </FieldWrapper>
  );
}
