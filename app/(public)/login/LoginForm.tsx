"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signIn, type AuthState } from "@/app/(public)/login/actions";

const initialState: AuthState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          label="Email"
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          required
        />
        <Input
          label="Contraseña"
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
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
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </Card>
  );
}
