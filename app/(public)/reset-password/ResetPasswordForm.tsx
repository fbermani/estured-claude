"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resetPassword, type ResetPasswordState } from "@/app/(public)/reset-password/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const initialState: ResetPasswordState = { status: "idle" };

export function ResetPasswordForm({ code }: { code: string }) {
  const [state, formAction, isPending] = useActionState(resetPassword, initialState);

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="code" value={code} />
        <Input
          label="Contraseña nueva"
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
          required
        />
        <Input
          label="Repetí la contraseña nueva"
          id="reset-password-confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        {state.status === "error" && (
          <div
            role="alert"
            className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg"
          >
            <p>{state.message}</p>
            {state.linkExpired && (
              <p className="mt-2">
                <Link href="/forgot-password" className="font-semibold underline underline-offset-2">
                  Pedir un enlace nuevo
                </Link>
              </p>
            )}
          </div>
        )}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </Card>
  );
}
