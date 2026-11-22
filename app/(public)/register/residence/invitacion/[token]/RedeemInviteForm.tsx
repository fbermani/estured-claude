"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { redeemResidenceInvite, type RedeemState } from "@/app/(public)/register/residence/invitacion/[token]/actions";
import { RESIDENCE_RESPONSIBILITY_LABEL } from "@/lib/legal/clauses";

const initialState: RedeemState = { status: "idle" };

export function RedeemInviteForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState(redeemResidenceInvite.bind(null, token), initialState);
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input label="Email de la cuenta" id="ri-email" type="email" value={email} readOnly disabled hint="Es el email que nos dejaste en la solicitud." />
      <Input label="Contraseña" id="ri-password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="Mínimo 8 caracteres. Solo la sabés vos: el equipo de EstuRed nunca la conoce." />
      <Input label="Repetir contraseña" id="ri-password-confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required />
      <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="accept_terms" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
          <span>
            Acepto las{" "}
            <a href="/terms/residencias" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">Condiciones para residencias</a>{" "}
            y la{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">Política de privacidad</a>{" "}
            de EstuRed.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="accept_responsibility" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
          <span>{RESIDENCE_RESPONSIBILITY_LABEL}</span>
        </label>
      </div>
      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">{state.message}</p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Creando tu cuenta…" : "Crear mi cuenta"}
      </Button>
    </form>
  );
}
