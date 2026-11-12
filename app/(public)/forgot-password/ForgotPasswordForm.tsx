"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  requestPasswordReset,
  type ForgotPasswordState,
} from "@/app/(public)/forgot-password/actions";

const initialState: ForgotPasswordState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  if (state.status === "sent") {
    return (
      <Card className="p-8">
        <div role="status" className="flex flex-col gap-4">
          <p className="text-base font-bold text-ink">Revisá tu casilla</p>
          <p className="text-sm leading-relaxed text-ink-soft">
            Si el email corresponde a una cuenta de EstuRed, te enviamos un enlace para elegir una
            contraseña nueva. El enlace tiene una vigencia limitada; si no lo ves, mirá también la
            carpeta de spam.
          </p>
          <Link
            href="/login"
            className="text-sm font-semibold text-forest-700 underline underline-offset-2"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <Input
          label="Email"
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          required
        />
        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg"
          >
            {state.message}
          </p>
        )}
        <TurnstileWidget resetKey={state} />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Enviando…" : "Enviar enlace"}
        </Button>
      </form>
    </Card>
  );
}
