import { useId, type ComponentPropsWithoutRef } from "react";

const fieldClasses =
  "w-full rounded-field border-[1.5px] border-field-border bg-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-muted transition-colors duration-200 ease-fresh focus:border-forest focus:outline-2 focus:outline-forest-tint disabled:bg-cream-2 disabled:text-muted";

interface FieldWrapperProps {
  label?: string;
  hint?: React.ReactNode;
  id?: string;
}

function FieldWrapper({
  label,
  hint,
  id,
  children,
}: FieldWrapperProps & { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-bold text-ink-soft">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input({
  label,
  hint,
  ...props
}: ComponentPropsWithoutRef<"input"> & FieldWrapperProps) {
  // Sin `id` explícito el <label> quedaba sin asociar al campo (H31): se genera uno.
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} id={id}>
      <input {...props} id={id} className={`${fieldClasses} ${props.className ?? ""}`} />
    </FieldWrapper>
  );
}

export function Textarea({
  label,
  hint,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & FieldWrapperProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} id={id}>
      <textarea
        rows={4}
        {...props}
        id={id}
        className={`${fieldClasses} ${props.className ?? ""}`}
      />
    </FieldWrapper>
  );
}

export function Select({
  label,
  hint,
  children,
  ...props
}: ComponentPropsWithoutRef<"select"> & FieldWrapperProps) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} id={id}>
      <select {...props} id={id} className={`${fieldClasses} ${props.className ?? ""}`}>
        {children}
      </select>
    </FieldWrapper>
  );
}
