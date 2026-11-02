"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Select } from "@/components/ui/Input";
import { fieldHint, fieldProps, useFocusOnError } from "@/app/(public)/register/useRegisterFormErrors";
import { BARRIO_OPTIONS } from "@/lib/residences/options";
import { requestResidenceSignup, type RequestResidenceState } from "@/app/(public)/register/residence/actions";

const initialState: RequestResidenceState = { status: "idle" };

/** Solicitud de alta de residencia (DR22): deja los datos principales; no crea cuenta. */
export function RegisterResidenceForm() {
  const [state, formAction, isPending] = useActionState(requestResidenceSignup, initialState);
  const { formRef, alertRef } = useFocusOnError(state);

  if (state.status === "success") {
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

  return (
    <Card className="p-8">
      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        <Input label="Nombre de la residencia" id="rr-residence-name" name="residence_name" enterKeyHint="next" placeholder="Ej: Residencia Los Andes" maxLength={120} required {...fieldProps(state, "residence_name", "rr")} hint={fieldHint(state, "residence_name", "rr", undefined)} />
        <Select label="Barrio" id="rr-neighborhood" name="neighborhood" required {...fieldProps(state, "neighborhood", "rr")} hint={fieldHint(state, "neighborhood", "rr", undefined)}>
          <option value="" disabled>
            Elegí una opción
          </option>
          {BARRIO_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
        <Input label="Nombre del responsable" id="rr-contact-name" name="contact_name" autoComplete="name" enterKeyHint="next" maxLength={120} required {...fieldProps(state, "contact_name", "rr")} hint={fieldHint(state, "contact_name", "rr", undefined)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Email" id="rr-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" placeholder="tu@email.com" required {...fieldProps(state, "email", "rr")} hint={fieldHint(state, "email", "rr", undefined)} />
          <Input label="Teléfono / WhatsApp" id="rr-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" placeholder="+54 9 11 ..." required {...fieldProps(state, "phone", "rr")} hint={fieldHint(state, "phone", "rr", undefined)} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Instagram o web (opcional)" id="rr-social" name="instagram_or_web" autoCapitalize="none" spellCheck={false} enterKeyHint="next" maxLength={200} {...fieldProps(state, "instagram_or_web", "rr")} hint={fieldHint(state, "instagram_or_web", "rr", undefined)} />
          <Input label="Camas aproximadas (opcional)" id="rr-beds" name="approx_beds" type="number" inputMode="numeric" enterKeyHint="done" min={1} max={2000} {...fieldProps(state, "approx_beds", "rr")} hint={fieldHint(state, "approx_beds", "rr", undefined)} />
        </div>
        {/* Honeypot: fuera de la vista y del orden de tabulación. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            No completar
            <input type="text" name="company_site" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <p className="text-sm text-ink-soft">
          No creás una cuenta ahora: el equipo de EstuRed se pone en contacto para conocer tu residencia. La dirección, los precios y las fotos se completan más adelante.
        </p>

        {state.status === "error" && (
          <p role="alert" ref={alertRef} tabIndex={-1} className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg focus:outline-2 focus:outline-danger-fg">
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Enviando…" : "Solicitar sumar mi residencia"}
        </Button>
      </form>
    </Card>
  );
}
