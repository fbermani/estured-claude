"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

export function RegisterStudentForm() {
  const [state, formAction, isPending] = useActionState(
    registerStudent,
    initialState,
  );

  const [birthDate, setBirthDate] = useState("");
  const showMinorNotice = birthDate !== "" && isUnder18(birthDate);

  return (
    <Card className="p-8">
      <form action={formAction} className="flex flex-col gap-5">
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
            required
          />
          <Input
            label="Apellido"
            id="reg-last-name"
            name="last_name"
            autoComplete="family-name"
            maxLength={80}
            hint="Privado — solo se muestra tu inicial."
            required
          />
        </div>
        <Input
          label="Fecha de nacimiento"
          id="reg-birth-date"
          name="birth_date"
          type="date"
          hint="Privada. Si sos menor de 18, te vamos a pedir un familiar vinculado para enviar solicitudes."
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
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
          <Input
            label="Email"
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            required
          />
          <Input
            label="Teléfono / WhatsApp"
            id="reg-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+54 9 11 ..."
            hint="Privado. Necesario para coordinar tu solicitud."
            required
          />
        </div>
        <Input
          label="Contraseña"
          id="reg-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          hint="Mínimo 8 caracteres."
          required
        />

        <div className="flex flex-col gap-3 rounded-field bg-sand-100 p-4">
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="accept_terms"
              required
              className="mt-0.5 h-4 w-4 accent-forest"
            />
            <span>
              Acepto los términos y condiciones de EstuRed y entiendo que actúa
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
              Acepto la política de privacidad. Mis datos sensibles (apellido,
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

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg"
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
