import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { NO_PERMISSION_NOTE } from "@/lib/residences/permissions";

/** Nota discreta: "Pedile este permiso al dueño." (o el texto que se pase). */
export function PermissionNote({ text = NO_PERMISSION_NOTE, className = "" }: { text?: string; className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs text-ink-faint ${className}`}>
      <Icon name="lock" className="mt-px text-sm" />
      <span>{text}</span>
    </p>
  );
}

/**
 * Deshabilita todo lo que lleve adentro (formularios, botones, campos) cuando la persona no tiene el permiso (DR11) y muestra la nota.
 * Es SOLO presentación: un `<fieldset disabled>` no es seguridad, el servidor valida cada acción con `assertResidencePermission`.
 * Los enlaces (`<a>`) no se deshabilitan: llevan a pantallas que ya validan por su cuenta.
 */
export function PermissionGate({
  allowed,
  children,
  note,
  className = "",
  bare = false,
}: {
  allowed: boolean;
  children: ReactNode;
  note?: string;
  className?: string;
  /** `bare`: sin contenedor ni nota (el fieldset no genera caja), para envolver un hijo de una grilla sin romper el layout. */
  bare?: boolean;
}) {
  if (allowed) return <>{children}</>;
  const disabledLook = "[&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50 [&_input:disabled]:opacity-60 [&_select:disabled]:opacity-60 [&_textarea:disabled]:opacity-60";
  if (bare) {
    return (
      <fieldset disabled className={`contents ${disabledLook}`}>
        {children}
      </fieldset>
    );
  }
  return (
    <div className={className}>
      <fieldset disabled className={`m-0 min-w-0 border-0 p-0 ${disabledLook}`}>
        {children}
      </fieldset>
      <PermissionNote text={note} className="mt-2" />
    </div>
  );
}
