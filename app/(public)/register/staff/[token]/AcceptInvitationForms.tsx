"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  acceptInvitationWithPassword,
  acceptInvitationWithSession,
  type AcceptInvitationState,
} from "@/app/(public)/register/staff/[token]/actions";

const initialState: AcceptInvitationState = { status: "idle" };

function ErrorNote({ state }: { state: AcceptInvitationState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
      {state.message}
    </p>
  );
}

/** Con una sesión abierta con el email invitado: aceptar con un clic. */
export function AcceptWithSessionForm({ token }: { token: string }) {
  const action = acceptInvitationWithSession.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ErrorNote state={state} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sumándote al equipo…" : "Aceptar y entrar al equipo"}
      </Button>
    </form>
  );
}

/** Sin sesión: contraseña (cuenta existente) o contraseña nueva + repetición (cuenta nueva). El formulario no distingue cuál es cuál. */
export function AcceptWithPasswordForm({ token, email }: { token: string; email: string }) {
  const action = acceptInvitationWithPassword.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Input label="Email invitado" id="staff-email" type="email" value={email} readOnly disabled hint="La invitación es para este email." />
      <Input
        label="Contraseña"
        id="staff-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        hint="Si ya tenés cuenta en EstuRed, ingresá la de siempre. Si es tu primera vez, elegí una de al menos 8 caracteres."
      />
      <Input
        label="Repetir contraseña (solo si es tu primera vez en EstuRed)"
        id="staff-password-confirmation"
        name="password_confirmation"
        type="password"
        autoComplete="new-password"
      />
      <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="accept_terms" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
          <span>
            Acepto los{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">
              términos y condiciones
            </a>{" "}
            de EstuRed.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="accept_privacy" required className="mt-0.5 h-4 w-4 shrink-0 accent-forest" />
          <span>
            Acepto la{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">
              política de privacidad
            </a>
            .
          </span>
        </label>
      </div>
      <ErrorNote state={state} />
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sumándote al equipo…" : "Aceptar y entrar al equipo"}
      </Button>
    </form>
  );
}
