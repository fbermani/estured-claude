"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input, Select } from "@/components/ui/Input";
import { updateFamilyProfile, type UpdateFamilyProfileState } from "@/app/students/profile/familyActions";
import { FAMILY_RELATIONSHIPS, VAT_CONDITIONS } from "@/lib/family/familyProfile";

const initialState: UpdateFamilyProfileState = { status: "idle" };

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="-mt-1 text-xs font-medium text-danger-fg">
      {message}
    </p>
  ) : null;
}

/** Perfil propio del familiar (DR4): datos de contacto y datos de facturación del pagador. */
export function FamilyProfileForm({
  firstName,
  lastName,
  phone,
  email,
  relationshipType,
  billingTaxId,
  billingVatCondition,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  relationshipType: string;
  billingTaxId: string;
  billingVatCondition: string;
}) {
  const [state, formAction, isPending] = useActionState(updateFamilyProfile, initialState);
  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Icon name="person" className="text-xl text-forest-700" />
          <h2 className="font-bold text-ink">Tus datos</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Input label="Nombre" name="first_name" defaultValue={v.first_name ?? firstName} required maxLength={80} autoComplete="given-name" />
            <FieldError message={errors.firstName} />
          </div>
          <div className="space-y-1.5">
            <Input label="Apellido" name="last_name" defaultValue={v.last_name ?? lastName} required maxLength={80} autoComplete="family-name" />
            <FieldError message={errors.lastName} />
          </div>
          <div className="space-y-1.5">
            <Input
              label="Teléfono de contacto"
              name="phone"
              type="tel"
              defaultValue={v.phone ?? phone}
              required
              autoComplete="tel"
              hint="Si el estudiante aprueba una propuesta tuya, este número se comparte con la residencia para coordinar."
            />
            <FieldError message={errors.phone} />
          </div>
          <div className="space-y-1.5">
            <Select label="Relación con el estudiante" name="relationship_type" defaultValue={v.relationship_type ?? relationshipType} required>
              {FAMILY_RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.relationshipType} />
          </div>
          <Input label="Email de tu cuenta" value={email} readOnly disabled hint="Para cambiarlo, escribinos desde Soporte." />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Icon name="receipt_long" className="text-xl text-forest-700" />
          <h2 className="font-bold text-ink">Datos de facturación del pagador</h2>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Si pagás el fee EstuRed, los datos de facturación del pago quedan a tu nombre. Los guardamos para no pedírtelos en cada
          pago; podés corregirlos antes de pagar. Son privados: nunca los ve la residencia.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Input
              label="CUIT o DNI"
              name="billing_tax_id"
              defaultValue={v.billing_tax_id ?? billingTaxId}
              inputMode="numeric"
              placeholder="20-12345678-6"
              hint="Opcional hasta el día del pago."
            />
            <FieldError message={errors.billingTaxId} />
          </div>
          <div className="space-y-1.5">
            <Select label="Condición frente al IVA" name="billing_vat_condition" defaultValue={v.billing_vat_condition ?? billingVatCondition}>
              <option value="">Sin completar</option>
              {VAT_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <FieldError message={errors.billingVatCondition} />
          </div>
        </div>
      </Card>

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p role="status" className="rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Guardando…" : "Guardar perfil"}
      </Button>
    </form>
  );
}
