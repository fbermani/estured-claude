"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { FormAlert, SubmitButton, errorHint, errorProps, useFocusOnError } from "@/components/preapertura/FormParts";
import { NETWORK_MESSAGE } from "@/lib/preapertura/formState";
import { SIGNUP_ALERT_EMPTY, SIGNUP_ALERT_INVALID, validateSignupFields } from "@/lib/residenceSignup/rules";
import { requestResidenceSignup, type RequestResidenceState } from "@/app/(public)/register/residence/actions";
import { CONTACT_EMAIL } from "@/lib/constants/contact";
import type { FounderPlace } from "@/lib/preapertura/rules";

const initialState: RequestResidenceState = { status: "idle" };

const TIMELINE = [
  { label: "Enviaste tu solicitud", sub: undefined, done: true },
  { label: "Te escribimos", sub: "Por mail o WhatsApp", now: true },
  { label: "Charla y visita", sub: undefined },
  { label: "Recibís tu cuenta", sub: undefined },
] as const;

/** Pantalla de éxito de preapertura (mockup v4): confirmación, lugar de fundadora según el cupo real y línea de tiempo de 4 pasos. */
function SuccessPreapertura({ founder }: { founder: FounderPlace | undefined }) {
  useEffect(() => {
    document.getElementById("pre-resi-done")?.focus();
  }, []);
  return (
    <div>
      <div className="grid justify-items-center gap-3 bg-forest-ink px-5 py-7 text-center text-white sm:px-9">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-gold text-forest-ink">
          <Icon name="mark_email_read" className="text-3xl" />
        </span>
        <h1 id="pre-resi-done" tabIndex={-1} className="font-display text-[clamp(26px,6.5vw,34px)] leading-tight tracking-tight">
          ¡Recibimos tu solicitud!
        </h1>
        <p role="status" className="max-w-[44ch] text-white/90">
          Te escribimos para conocerte y coordinar una visita. Todavía no hace falta crear una cuenta.
        </p>
      </div>
      <div className="grid gap-4 px-5 pb-6 pt-5 sm:px-9 sm:pb-8 sm:pt-6">
        {founder === "cupo" && (
          <p className="flex items-start gap-3 rounded-field border-l-4 border-gold bg-butter px-4 py-3 text-sm text-butter-fg">
            <Icon name="workspace_premium" className="text-2xl" />
            <span>
              <b className="block text-ink">Ocupás uno de los 10 lugares de fundadora</b>
              Lo mantenés mientras avanzamos con la visita.
            </span>
          </p>
        )}
        {founder === "lleno" && (
          <p className="flex items-start gap-3 rounded-field border-l-4 border-line-2 bg-cream px-4 py-3 text-sm text-ink-soft">
            <Icon name="hourglass_top" className="text-2xl" />
            <span>
              <b className="block text-ink">Los 10 lugares de fundadora están en proceso</b>
              Si alguno se libera, te lo contamos. Tu solicitud sigue su curso igual.
            </span>
          </p>
        )}
        <ol className="grid gap-2.5">
          {TIMELINE.map((step, i) => {
            const done = "done" in step && step.done;
            const now = "now" in step && step.now;
            return (
              <li key={step.label} aria-current={now ? "step" : undefined} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    done ? "bg-forest text-white" : now ? "bg-orange text-white" : "bg-cream-2 text-ink-soft"
                  }`}
                >
                  {done ? <Icon name="check" className="text-lg" /> : i + 1}
                </span>
                <span className="text-[15px]">
                  <b className="text-ink">{step.label}</b>
                  {step.sub && <span className="block text-sm text-ink-soft">{step.sub}</span>}
                  {done && <span className="sr-only"> (hecho)</span>}
                  {now && <span className="sr-only"> (sigue)</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm text-ink-soft">
          ¿Algún dato está mal?{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-forest-700 underline underline-offset-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
            {CONTACT_EMAIL}
          </a>
        </p>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-1 rounded-field text-sm font-bold text-ink-soft hover:text-ink hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
          <Icon name="arrow_back" className="text-xl" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

/**
 * Solicitud de alta de residencia (DR22, DR46.4): 5 datos OBLIGATORIOS (nombre de la residencia, dirección, responsable, teléfono /
 * WhatsApp y email); no crea cuenta. Validación en el cliente (mismas reglas que el servidor, que es la que cuenta) y en el servidor.
 * `variant="preapertura"` es el lenguaje del popup v4 (alerta de «Completá los 5 datos», error por campo con `aria-invalid`, estado
 * «Enviando…», pantalla de éxito con el lugar de fundadora); `default` mantiene la tarjeta de siempre, con Instagram/camas opcionales.
 */
export function RegisterResidenceForm({ variant = "default" }: { variant?: "default" | "preapertura" }) {
  const pre = variant === "preapertura";
  const [state, formAction, isPending] = useActionState<RequestResidenceState, FormData>(async (prev, formData) => {
    try {
      return await requestResidenceSignup(prev, formData);
    } catch {
      return { status: "error", message: NETWORK_MESSAGE, values: prev.values };
    }
  }, initialState);
  const [clientErrors, setClientErrors] = useState<{ errors: Record<string, string>; empty: boolean } | null>(null);

  const serverFailed = state.status === "error" && !clientErrors;
  const errors = clientErrors?.errors ?? (state.status === "error" ? state.fieldErrors : undefined);
  const failed = Boolean(clientErrors) || state.status === "error";
  const { formRef, alertRef } = useFocusOnError(clientErrors ?? state, failed);

  if (state.status === "success") {
    if (pre) return <SuccessPreapertura founder={state.founder} />;
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-2 text-forest-700">
          <Icon name="mark_email_read" className="text-3xl" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">Recibimos tu solicitud</h2>
        <p role="status" className="mt-2 text-sm text-ink-soft">
          Te escribimos por mail o WhatsApp para coordinar.
        </p>
      </Card>
    );
  }

  const value = (name: string) => state.values?.[name] ?? "";
  const invalidCls = "aria-invalid:border-danger-fg";
  const alertTitle = clientErrors
    ? clientErrors.empty
      ? SIGNUP_ALERT_EMPTY
      : SIGNUP_ALERT_INVALID
    : state.message === SIGNUP_ALERT_EMPTY || state.message === SIGNUP_ALERT_INVALID
      ? state.message
      : "No pudimos enviar tus datos.";

  const form = (
    <form
      ref={formRef}
      noValidate
      // Sin `action`: React 19 resetearía los campos al terminar la acción y se perdería lo escrito tras un error.
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending) return;
        const data = new FormData(event.currentTarget);
        const raw: Record<string, string> = {};
        for (const [k, v] of data.entries()) if (typeof v === "string") raw[k] = v;
        const checked = validateSignupFields(raw);
        if (!checked.value) {
          setClientErrors({ errors: checked.errors, empty: checked.anyRequiredEmpty });
          return;
        }
        setClientErrors(null);
        startTransition(() => formAction(data));
      }}
      className={pre ? "grid gap-4" : "flex flex-col gap-5"}
    >
      {failed && (
        <FormAlert title={alertTitle} alertRef={alertRef}>
          {serverFailed && alertTitle === "No pudimos enviar tus datos." ? state.message : undefined}
        </FormAlert>
      )}
      <div className={pre ? "grid gap-4 sm:grid-cols-2" : "contents"}>
        <Input
          id="rr-residence_name"
          name="residence_name"
          label="Nombre de la residencia"
          enterKeyHint="next"
          placeholder="Ej.: Residencia Los Andes"
          maxLength={120}
          required
          defaultValue={value("residence_name")}
          hint={errorHint(errors, "residence_name", "rr")}
          className={invalidCls}
          {...errorProps(errors, "residence_name", "rr")}
        />
        <Input
          id="rr-address"
          name="address"
          label="Dirección"
          autoComplete="street-address"
          enterKeyHint="next"
          placeholder="Ej.: Av. Córdoba 1234, CABA"
          maxLength={200}
          required
          defaultValue={value("address")}
          hint={errorHint(errors, "address", "rr")}
          className={invalidCls}
          {...errorProps(errors, "address", "rr")}
        />
        <Input
          id="rr-contact_name"
          name="contact_name"
          label={pre ? "Tu nombre" : "Nombre del responsable"}
          autoComplete="name"
          enterKeyHint="next"
          maxLength={120}
          required
          defaultValue={value("contact_name")}
          hint={errorHint(errors, "contact_name", "rr")}
          className={invalidCls}
          {...errorProps(errors, "contact_name", "rr")}
        />
        <Input
          id="rr-phone"
          name="phone"
          label="Teléfono / WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
          placeholder="+54 9 11 1234-5678"
          required
          defaultValue={value("phone")}
          hint={errorHint(errors, "phone", "rr")}
          className={invalidCls}
          {...errorProps(errors, "phone", "rr")}
        />
      </div>
      <Input
        id="rr-email"
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint={pre ? "done" : "next"}
        placeholder="tu@email.com"
        required
        defaultValue={value("email")}
        hint={errorHint(errors, "email", "rr")}
        className={invalidCls}
        {...errorProps(errors, "email", "rr")}
      />
      {!pre && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id="rr-instagram_or_web"
            name="instagram_or_web"
            label="Instagram o web (opcional)"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={200}
            defaultValue={value("instagram_or_web")}
            hint={errorHint(errors, "instagram_or_web", "rr")}
            className={invalidCls}
            {...errorProps(errors, "instagram_or_web", "rr")}
          />
          <Input
            id="rr-approx_beds"
            name="approx_beds"
            label="Camas aproximadas (opcional)"
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min={1}
            max={2000}
            defaultValue={value("approx_beds")}
            hint={errorHint(errors, "approx_beds", "rr")}
            className={invalidCls}
            {...errorProps(errors, "approx_beds", "rr")}
          />
        </div>
      )}
      {/* Honeypot: fuera de la vista y del orden de tabulación. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No completar
          <input type="text" name="company_site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {pre ? (
        <p className="text-sm text-ink-soft">
          Al enviar aceptás la{" "}
          <a href="/consentimientos#privacidad" target="_blank" rel="noopener" className="font-bold text-forest-700 underline underline-offset-2">
            Política de privacidad
          </a>
          .
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          No creás una cuenta ahora: el equipo de EstuRed se pone en contacto para conocer tu residencia. Los precios y las fotos se completan más adelante.
        </p>
      )}
      <SubmitButton idle={pre ? "Quiero que me contacten" : "Solicitar sumar mi residencia"} pending="Enviando…" isPending={isPending} />
    </form>
  );

  if (!pre) {
    return <Card className="p-8">{form}</Card>;
  }
  return (
    <div className="px-5 pb-6 pt-4 sm:px-9 sm:pb-8 sm:pt-5">
      <Link href="/fundadoras" className="inline-flex min-h-11 items-center gap-1 rounded-field text-sm font-bold text-forest-700 hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink">
        <Icon name="arrow_back" className="text-xl" />
        Volver
      </Link>
      <h1 id="pre-resi-title" className="mt-1 font-display text-2xl leading-tight tracking-tight text-ink">
        ¿Cómo te contactamos?
      </h1>
      <div className="mt-4">{form}</div>
    </div>
  );
}
