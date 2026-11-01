"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminActionState } from "@/app/admin/solicitudes-alta/actions";

const initial: AdminActionState = { status: "idle" };

/** `<form>` de una acción del admin que muestra el error (o la confirmación) en línea. Los botones usan name/value nativos. */
export function ActionForm({
  action,
  children,
  className,
  okMessage,
}: {
  action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
  children: ReactNode;
  className?: string;
  okMessage?: string;
}) {
  const [state, formAction] = useActionState(action, initial);
  return (
    <form action={formAction} className={className}>
      {children}
      {state.status === "error" && (
        <p role="alert" className="mt-1 w-full text-xs font-semibold text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "ok" && okMessage && (
        <p role="status" className="mt-1 w-full text-xs font-semibold text-emerald-700">
          {okMessage}
        </p>
      )}
    </form>
  );
}
