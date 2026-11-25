"use client";

import { DevAccountNotice, DevEmptyHint } from "@/components/preapertura/DevAccountNotice";
import { BackNav } from "@/components/preapertura/BackNav";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { trackMetaEvent } from "@/lib/analytics/metaPixel";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { registerFamilyInvite } from "@/app/(preapertura)/preregistro/familiar/actions";
import { NETWORK_MESSAGE, type FamilyState } from "@/lib/preapertura/formState";
import {
  AlreadyIn,
  CheckRow,
  CopyLinkButton,
  FormAlert,
  PasswordField,
  SubmitButton,
  errorHint,
  errorProps,
  useFocusOnError,
} from "@/components/preapertura/FormParts";

const INITIAL: FamilyState = { status: "idle" };

/**
 * Registro familiar (SPEC pantalla 4, mockup v4): una sola pantalla con la cuenta del familiar, el mail del hijo/a y el casillero
 * de Términos y Privacidad (sin la opción C: esa es del estudiante). CTA «Crear cuenta e invitar». Al terminar se muestra el link de
 * la invitación para copiar (y si el mail salió, se dice); recién ahí se pasa a «Mi lugar». Una sola invitación, sin recordatorios.
 */
export function FamilyForm({ loggedIn }: { loggedIn: boolean }) {
  const [state, formAction, isPending] = useActionState<FamilyState, FormData>(async (prev, formData) => {
    try {
      return await registerFamilyInvite(prev, formData);
    } catch {
      return { status: "error", code: "network", message: NETWORK_MESSAGE, values: prev.values };
    }
  }, INITIAL);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [adult, setAdult] = useState(false);

  const failed = state.status === "error";
  const errors = failed ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(errors && Object.keys(errors).length > 0);
  const { formRef, alertRef } = useFocusOnError(state, failed);

  // Al llegar el resultado el foco pasa al título de la pantalla de éxito (el formulario desaparece).
  const tracked = useRef(false);
  useEffect(() => {
    if (state.status !== "success") return;
    document.getElementById("pre-family-done")?.focus();
    // Pixel: una sola vez por envío exitoso, sin datos personales.
    if (!tracked.current) {
      tracked.current = true;
      trackMetaEvent("CompleteRegistration", "preregistro_familiar");
    }
  }, [state.status]);

  // Ver el comentario de `Step1Form`: el aviso no puede depender de un redirect de servidor porque la sesión nace con este mismo envío.
  if (loggedIn && state.status !== "success") return <AlreadyIn titleId="pre-family-title" />;

  if (state.status === "success") {
    return (
      <div className="p-5 @min-[640px]:px-9 @min-[640px]:py-8">
        <BackNav href="/">Volver al inicio</BackNav>
        <p className="flex items-center gap-2 text-sm font-bold text-ink-soft">Registro familiar</p>
        <h1 id="pre-family-title" className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink">
          Listo, ya estás adentro
        </h1>
        <div id="pre-family-done" tabIndex={-1} className="mt-4 grid gap-3 rounded-field focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink" role="status">
          {state.devEmail && <DevAccountNotice email={state.devEmail} />}
          <FormAlert
            tone="ok"
            icon="check_circle"
            title={state.emailSent ? "Le mandamos la invitación." : "Tu cuenta está creada."}
          >
            {state.emailSent
              ? `Salió un mail a ${state.inviteeEmail}. Es el único con el que puede sumarse si es menor de 18; avisale que lo revise.`
              : `No salió el mail a ${state.inviteeEmail} (modo desarrollo): usá el link de abajo para probar.`}
          </FormAlert>
          {state.invitePath && (
            <div className="flex flex-wrap items-center gap-2">
              <CopyLinkButton path={state.invitePath} label="Copiar link (solo desarrollo)" copiedLabel="¡Link copiado!" />
            </div>
          )}
          <Button href={state.redirectTo ?? "/mi-lugar"} variant="secondary" size="lg" className="w-full shadow-orange">
            Continuar
            <Icon name="arrow_forward" className="text-xl" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 @min-[640px]:px-9 @min-[640px]:py-8">
      <BackNav href="/">Volver al inicio</BackNav>
      <p className="text-sm font-bold text-ink-soft">Registro familiar</p>
      <h1 id="pre-family-title" className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink">
        Registrate primero e invitalo/a
      </h1>

      {failed && state.code === "email_exists" ? (
        <FormAlert title="Ya hay una cuenta con ese email." alertRef={alertRef} className="mt-4">
          <Link href="/login" className="font-bold underline underline-offset-2">
            Ingresá
          </Link>{" "}
          o{" "}
          <Link href="/forgot-password" className="font-bold underline underline-offset-2">
            recuperá tu contraseña
          </Link>
          .
        </FormAlert>
      ) : failed && state.code === "network" ? (
        <FormAlert icon="wifi_off" title="No pudimos crear tu cuenta." alertRef={alertRef} className="mt-4">
          {state.message}
        </FormAlert>
      ) : failed && hasFieldErrors ? (
        <FormAlert title="Revisá los campos marcados." alertRef={alertRef} className="mt-4" />
      ) : failed ? (
        <FormAlert title="No pudimos crear tu cuenta." alertRef={alertRef} className="mt-4">
          {state.message}
        </FormAlert>
      ) : null}

      <form
        ref={formRef}
        // Sin `action`: React 19 resetea el formulario al terminar la acción y desmarcaría los casilleros y pastillas controlados.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        noValidate className="mt-4 grid gap-4">
        <Input
          id="pre-email"
          name="email"
          label="Tu email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu@email.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint={errorHint(errors, "email", "pre")}
          className="aria-invalid:border-danger-fg"
          {...errorProps(errors, "email", "pre")}
        />
        <PasswordField value={password} onChange={setPassword} error={errors?.password} errorId="pre-password-error" hint="Mínimo 8 caracteres." />

        <div className="grid gap-3 border-t border-dashed border-line-2 pt-4">
          <p className="text-sm font-bold text-orange-700">Tu hijo/a</p>
          <Input
            id="pre-student_email"
            name="student_email"
            label="Su email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="su@email.com"
            required
            value={studentEmail}
            onChange={(event) => setStudentEmail(event.target.value)}
            hint={errorHint(errors, "student_email", "pre", "Le mandamos la invitación. Si es menor de 18, solo puede sumarse así.")}
            className="aria-invalid:border-danger-fg"
            {...errorProps(errors, "student_email", "pre")}
          />
        </div>

        <div className="grid gap-1.5">
          <CheckRow
            name="accept_adult"
            checked={adult}
            onChange={setAdult}
            describedBy={errors?.accept_adult ? "pre-accept_adult-error" : undefined}
            invalid={Boolean(errors?.accept_adult)}
          >
            Soy mayor de 18 años.
          </CheckRow>
          {errors?.accept_adult && <p>{errorHint(errors, "accept_adult", "pre")}</p>}
        </div>

        <div className="grid gap-1.5">
          <CheckRow
            name="accept_terms"
            checked={accepted}
            onChange={setAccepted}
            describedBy={errors?.accept_terms ? "pre-accept_terms-error" : undefined}
            invalid={Boolean(errors?.accept_terms)}
          >
            Acepto los{" "}
            <a href="/consentimientos#terminos" target="_blank" rel="noopener" className="font-bold text-forest-700 underline underline-offset-2">
              Términos
            </a>{" "}
            y la{" "}
            <a href="/consentimientos#privacidad" target="_blank" rel="noopener" className="font-bold text-forest-700 underline underline-offset-2">
              Privacidad
            </a>
            .
          </CheckRow>
          {errors?.accept_terms && <p>{errorHint(errors, "accept_terms", "pre")}</p>}
        </div>
        <TurnstileWidget resetKey={state} />
        <SubmitButton isPending={isPending} idle="Crear cuenta e invitar" pending="Creando y enviando…" />
        <DevEmptyHint />
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Sos estudiante?{" "}
        <Link href="/preregistro" className="inline-flex min-h-11 items-center font-bold text-forest-700 underline underline-offset-2">
          Registrate acá
        </Link>
      </p>
    </div>
  );
}
