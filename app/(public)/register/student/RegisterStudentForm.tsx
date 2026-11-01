"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { fieldHint, fieldProps, useFocusOnError } from "@/app/(public)/register/useRegisterFormErrors";
import {
  registerStudent,
  type RegisterState,
} from "@/app/(public)/register/student/actions";

const initialState: RegisterState = { status: "idle" };

/** Solo para anticipar el aviso en pantalla; la edad que vale la calcula el servidor. */
function isUnder18(isoDate: string): boolean {
  const birth = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return birth > limit;
}

/** `invite`: registro desde el enlace personal de una residencia (DR19). El mail sale de la invitación (el servidor lo ignora del formulario). */
export function RegisterStudentForm({
  invite,
  residences = [],
}: { invite?: { token: string; maskedEmail: string }; residences?: { id: string; name: string; area: string | null }[] } = {}) {
  const [state, formAction, isPending] = useActionState(
    registerStudent,
    initialState,
  );
  const { formRef, alertRef } = useFocusOnError(state);

  const [birthDate, setBirthDate] = useState("");
  const showMinorNotice = birthDate !== "" && isUnder18(birthDate);

  return (
    <Card className="p-8">
      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        {invite && <input type="hidden" name="invite" value={invite.token} />}
        <p className="text-sm text-ink-soft">
          Paso 1 de 2 — lo justo para crear tu cuenta. El resto de tu perfil (universidad, nacionalidad,
          documentos) lo completás después, sin apuro.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Nombre"
            id="reg-first-name"
            name="first_name"
            autoComplete="given-name"
            maxLength={80}
            required {...fieldProps(state, "first_name", "reg")} hint={fieldHint(state, "first_name", "reg", undefined)} />
          <Input
            label="Apellido"
            id="reg-last-name"
            name="last_name"
            autoComplete="family-name"
            maxLength={80}
            required {...fieldProps(state, "last_name", "reg")} hint={fieldHint(state, "last_name", "reg", "Privado — solo se muestra tu inicial.")} />
        </div>
        <Input
          label="Fecha de nacimiento"
          id="reg-birth-date"
          name="birth_date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
          {...fieldProps(state, "birth_date", "reg", undefined, false)}
          hint={fieldHint(state, "birth_date", "reg", "Privada. Si sos menor de 18, te vamos a pedir un familiar vinculado para enviar solicitudes.")}
        />
        {showMinorNotice && (
          <p
            role="status"
            className="-mt-2 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-fg"
          >
            <Icon name="family_restroom" className="mt-0.5 shrink-0 text-lg" />
            <span>
              Podés crear tu cuenta y explorar residencias. Para enviar una solicitud de reserva necesitás un
              familiar vinculado: apenas termines, lo invitás por email desde tu panel.
            </span>
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          {invite ? (
            <Input
              label="Email"
              id="reg-email"
              type="text"
              value={invite.maskedEmail}
              readOnly
              disabled
              hint="Es el mail de tu invitación: no se puede cambiar."
            />
          ) : (
            <Input
              label="Email"
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              required {...fieldProps(state, "email", "reg")} hint={fieldHint(state, "email", "reg", undefined)} />
          )}
          <Input
            label="Teléfono / WhatsApp"
            id="reg-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 11 ..."
            required {...fieldProps(state, "phone", "reg")} hint={fieldHint(state, "phone", "reg", "Privado. Necesario para coordinar tu solicitud.")} />
        </div>
        <Input
          label="Contraseña"
          id="reg-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required {...fieldProps(state, "password", "reg", undefined, false)} hint={fieldHint(state, "password", "reg", "Mínimo 8 caracteres.")} />

        <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="accept_terms"
              required
              className="mt-0.5 h-4 w-4 accent-forest"
            />
            <span>
              Acepto los{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">términos y condiciones</a> de EstuRed y entiendo que actúa
              como plataforma intermediaria de solicitud, registro, soporte y
              comprobante.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="accept_privacy"
              required
              className="mt-0.5 h-4 w-4 accent-forest"
            />
            <span>
              Acepto la{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-700 underline">política de privacidad</a>. Mis datos sensibles (apellido,
              fecha de nacimiento, universidad, contacto) nunca se muestran
              públicamente.
            </span>
          </label>
        </div>

        {showMinorNotice ? (
          <p className="flex items-start gap-2 rounded-field bg-sand-100 px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
            <Icon name="shield_person" className="mt-0.5 shrink-0 text-base" />
            <span>
              Mientras seas menor, tu perfil no aparece en la comunidad de ninguna residencia. Cuando cumplas 18 vas
              a poder activarlo.
            </span>
          </p>
        ) : (
          <label className="flex items-start gap-3 rounded-field border border-line-2 p-4 text-sm text-ink">
            <input type="checkbox" name="community_opt_in" className="mt-0.5 h-4 w-4 accent-forest" />
            <span>
              <span className="font-semibold">
                Quiero aparecer en la comunidad de mi residencia cuando me aloje{" "}
                <span className="font-normal text-ink-faint">(opcional)</span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-faint">
                Otros usuarios registrados van a ver tu nombre de pila y tu texto «Sobre mí». Qué datos más se
                muestran lo elegís después en tu perfil, y podés cambiarlo cuando quieras. Si no la marcás, solo se
                ve que hay una plaza ocupada.
              </span>
            </span>
          </label>
        )}


        {!invite && (
          <details className="group rounded-field border border-line-2 p-4" open={!!(state.values?.link_residence_id || state.values?.missing_residence_name) || undefined}>
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="apartment" className="text-xl text-forest-700" />
              Ya vivo en una residencia <span className="font-normal text-ink-faint">(opcional)</span>
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              {residences.length > 0 && (
                <Select label="Mi residencia" id="reg-link-residence" name="link_residence_id" {...fieldProps(state, "link_residence_id", "reg")} hint={fieldHint(state, "link_residence_id", "reg", undefined)} >
                  <option value="">Elegí una…</option>
                  {residences.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.area ? ` · ${r.area}` : ""}
                    </option>
                  ))}
                </Select>
              )}
              <details open={!!state.values?.missing_residence_name || undefined}>
                <summary className="min-h-11 cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">Mi residencia no está en la lista</summary>
                <div className="mt-2">
                  <Input
                    label="Nombre de tu residencia"
                    id="reg-missing-name"
                    name="missing_residence_name"
                    maxLength={120} {...fieldProps(state, "missing_residence_name", "reg")} hint={fieldHint(state, "missing_residence_name", "reg", "Si no la elegiste arriba. Lo registramos para que el equipo de EstuRed pueda invitarla.")} />
                </div>
              </details>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
                <Icon name="verified_user" className="mt-0.5 shrink-0 text-base" />
                <span>Tu residencia tiene que aprobar el vínculo. Hasta entonces no ves ni aparecés en ninguna comunidad.</span>
              </p>
            </div>
          </details>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            ref={alertRef}
            tabIndex={-1}
            className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg focus:outline-2 focus:outline-danger-fg"
          >
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Creando tu cuenta…" : "Crear mi cuenta"}
        </Button>
      </form>
    </Card>
  );
}
