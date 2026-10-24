"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Botón de envío de los formularios de "Quiero cambiar": spinner con texto mientras se envía (`useFormStatus`) y
 * `aria-disabled` (no `disabled`) cuando falta una confirmación, para que la ayuda visible siga siendo accesible.
 */
export function StayChangeSubmit({
  children,
  pendingLabel,
  blocked = false,
  variant = "primary",
  danger = false,
  size = "sm",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  blocked?: boolean;
  variant?: "primary" | "outline" | "secondary" | "ghost";
  /** Relleno `danger-fg` (cancelar aviso). */
  danger?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const inactive = blocked || pending;
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      aria-disabled={inactive}
      onClick={(event) => {
        if (inactive) event.preventDefault();
      }}
      className={`${danger ? "bg-danger-fg! text-white! hover:bg-red-600! hover:shadow-none!" : ""} ${inactive ? "opacity-60" : ""} ${className}`}
    >
      {pending && <Icon name="progress_activity" className="animate-spin text-lg motion-reduce:animate-none" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
