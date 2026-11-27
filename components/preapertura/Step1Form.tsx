"use client";

import { DevEmptyHint } from "@/components/preapertura/DevAccountNotice";
import { BackNav } from "@/components/preapertura/BackNav";
import { RoleTabs } from "@/components/preapertura/RoleTabs";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { trackMetaEvent } from "@/lib/analytics/metaPixel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { registerStudentStep1 } from "@/app/(preapertura)/preregistro/actions";
import { NETWORK_MESSAGE, type Step1State } from "@/lib/preapertura/formState";
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

const INITIAL: Step1State = { status: "idle" };

/**
 * Registro del estudiante (DR67): selector estudiante o familiar (sin él con invitación), email, contraseña, fecha de nacimiento y UN casillero obligatorio sin tildar (Términos,
 * Privacidad y opción C, DR45.1). La validación real es la del servidor; acá solo se pintan los estados: enviando, error de campos,
 * email ya registrado, sin conexión y menor de 18 (no se crea cuenta). Sin Google: no existe OAuth (DR26). Con `invitation`, el mail
 * viene de la invitación familiar (no se edita) y un menor entra salteando el bloqueo de edad.
 */
export function Step1Form({ invitation, loggedIn }: { invitation: { token: string; email: string } | null; loggedIn: boolean }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<Step1State, FormData>(async (prev, formData) => {
    try {
      return await registerStudentStep1(prev, formData);
    } catch {
      // Sin conexión (o el servidor no respondió): se avisa y los datos siguen en los campos (son controlados).
      return { status: "error", code: "network", message: NETWORK_MESSAGE, values: prev.values };
    }
  }, INITIAL);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birth, setBirth] = useState("");
  const [accepted, setAccepted] = useState(false);
  const failed = state.status === "error";
  const errors = failed ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(errors && Object.keys(errors).length > 0);
  const { formRef, alertRef } = useFocusOnError(state, failed);

  // Pixel: el alta se cuenta una sola vez por envío exitoso (el estado vive en memoria: recargar no lo repite). Sin datos personales.
  const tracked = useRef(false);
  useEffect(() => {
    if (state.status !== "success") return;
    if (!tracked.current) {
      tracked.current = true;
      trackMetaEvent("CompleteRegistration", "preregistro_estudiante");
    }
    if (!state.redirectTo) return;
    // Con invitación puede ser un menor: carga completa para que el layout vuelva a decidir, ya con sesión, si hay pixel.
    if (invitation) window.location.replace(state.redirectTo);
    else router.replace(state.redirectTo);
  }, [state, router, invitation]);

  // El menor se detecta en el servidor con la fecha que mandó: si la cambia, el aviso deja de aplicar y puede volver a intentar.
  const minor = state.status === "minor" && state.values?.birth_date === birth;

  // Con sesión iniciada no hay nada que registrar. No se redirige desde el servidor: al crear la cuenta la sesión recién nace y la
  // pantalla se vuelve a renderizar antes de que el cliente siga al paso 2 (por eso el aviso solo aplica mientras no hubo éxito acá).
  if (loggedIn && state.status !== "success") return <AlreadyIn />;

  return (
    <div className="p-5 @min-[640px]:px-9 @min-[640px]:py-5">
      <BackNav href="/">Volver al inicio</BackNav>
      <h1 id="pre-signup-title" className="mt-1 font-display text-3xl leading-tight tracking-tight text-ink">
        Sumate en un minuto
      </h1>
      {!invitation && (
        <div className="mt-3">
          <RoleTabs current="student" />
        </div>
      )}

      {invitation && (
        <FormAlert tone="info" icon="family_restroom" title="Te invitó un familiar" className="mt-4">
          Vas a crear tu cuenta con {invitation.email}.
        </FormAlert>
      )}

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
        <FormAlert title={state.message ?? "No pudimos crear tu cuenta."} alertRef={alertRef} className="mt-4" />
      ) : null}

      <form
        ref={formRef}
        // Sin `action`: React 19 resetea el formulario al terminar la acción y desmarcaría los casilleros y pastillas controlados.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        noValidate className="mt-4 grid gap-3">
        {invitation && <input type="hidden" name="invitacion" value={invitation.token} />}
        <Input
          id="pre-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tu@email.com"
          required
          readOnly={Boolean(invitation)}
          value={invitation ? invitation.email : email}
          onChange={(event) => setEmail(event.target.value)}
          hint={errorHint(errors, "email", "pre", invitation ? "El mail de tu invitación no se puede cambiar." : undefined)}
          {...errorProps(errors, "email", "pre")}
        />
        <div className="grid items-start gap-3 @min-[960px]:grid-cols-2">
          <PasswordField
            value={password}
            onChange={setPassword}
            error={errors?.password}
            errorId="pre-password-error"
            hint="Mínimo 8 caracteres."
          />
          <Input
            id="pre-birth"
            name="birth_date"
            label="Fecha de nacimiento"
            type="date"
            autoComplete="bday"
            required
            value={birth}
            onChange={(event) => setBirth(event.target.value)}
            hint={
              minor ? (
                <span className="flex items-start gap-1.5 text-sm font-semibold text-info-fg">
                  <Icon name="info" className="text-lg" />
                  Tenés menos de 18 años.
                </span>
              ) : (
                errorHint(errors, "birth_date", "pre", invitation ? undefined : "Necesitamos saber si ya cumpliste 18. Si sos menor, tu familiar te invita.")
              )
            }
            {...errorProps(errors, "birth_date", "pre")}
          />
        </div>

        {minor ? (
          <div role="status" className="grid gap-2.5 rounded-field border-l-4 border-orange bg-orange-tint p-4">
            <p className="flex items-center gap-2 font-display text-[17px] font-bold leading-tight text-ink">
              <Icon name="family_restroom" className="text-2xl text-orange-700" />
              Sumate con tu familia
            </p>
            <p className="text-sm text-ink">
              Pedile a tu mamá, papá o a un familiar que se registre y te invite. Así sus cuentas quedan conectadas.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button href="/preregistro/familiar" variant="secondary" size="sm">
                Ir al registro familiar
              </Button>
              <CopyLinkButton path="/preregistro/familiar" label="Copiar link para mi familia" copiedLabel="¡Link copiado!" />
            </div>
          </div>
        ) : (
          <>
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
                , incluido mostrar mi búsqueda sin nombre ni contacto a residencias verificadas.
              </CheckRow>
              {errors?.accept_terms && <p>{errorHint(errors, "accept_terms", "pre")}</p>}
            </div>
            {!invitation && <TurnstileWidget resetKey={state} />}
            <SubmitButton isPending={isPending} idle="Sumarme" pending="Creando tu cuenta…" />
            <DevEmptyHint />
          </>
        )}
      </form>

    </div>
  );
}
