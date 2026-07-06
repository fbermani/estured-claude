import type { ComponentPropsWithoutRef } from "react";

const fieldClasses =
  "w-full rounded-field border border-sand-300 bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-petrol-400 focus:outline-2 focus:outline-petrol-200 disabled:bg-sand-100";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
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
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Input({
  label,
  hint,
  ...props
}: ComponentPropsWithoutRef<"input"> & FieldWrapperProps) {
  return (
    <FieldWrapper label={label} hint={hint} id={props.id}>
      <input {...props} className={`${fieldClasses} ${props.className ?? ""}`} />
    </FieldWrapper>
  );
}

export function Textarea({
  label,
  hint,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & FieldWrapperProps) {
  return (
    <FieldWrapper label={label} hint={hint} id={props.id}>
      <textarea
        rows={4}
        {...props}
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
  return (
    <FieldWrapper label={label} hint={hint} id={props.id}>
      <select {...props} className={`${fieldClasses} ${props.className ?? ""}`}>
        {children}
      </select>
    </FieldWrapper>
  );
}
