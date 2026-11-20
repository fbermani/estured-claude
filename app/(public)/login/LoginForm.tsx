"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { Input } from "@/components/ui/Input";
import { signIn, type AuthState } from "@/app/(public)/login/actions";

const initialState: AuthState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  // Controlado: React vacía el formulario tras cada envío y, si las credenciales fallan, había que reescribir el email.
  const [email, setEmail] = useState("");

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}
        <Input
          label="Email"
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Contraseña"
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          enterKeyHint="go"
          placeholder="Tu contraseña"
          required
        />
        <p className="-mt-2 text-right text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-forest-700 underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
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
          {isPending ? "Entrando…" : "Iniciar sesión"}
        </Button>
      </form>
    </Card>
  );
}
