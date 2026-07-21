"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateStudentProfileDetails, type UpdateProfileState } from "@/app/students/profile/actions";

const initialState: UpdateProfileState = { status: "idle" };

export function ProfileDetailsForm({
  nationality,
  studyInstitution,
  originCity,
  profileVisible,
}: {
  nationality: string;
  studyInstitution: string;
  originCity: string;
  profileVisible: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateStudentProfileDetails, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <Input
        label="Nacionalidad"
        id="profile-nationality"
        name="nationality"
        placeholder="Ej: Argentina"
        maxLength={60}
        defaultValue={nationality}
      />
      <Input
        label="¿Dónde vas a estudiar?"
        id="profile-institution"
        name="study_institution"
        placeholder="Ej: UBA Medicina, Universidad de Palermo…"
        hint="Nos ayuda a mostrarte residencias bien ubicadas."
        maxLength={160}
        defaultValue={studyInstitution}
      />
      <Input
        label="Ciudad de origen (opcional)"
        id="profile-origin-city"
        name="origin_city"
        placeholder="Ej: Córdoba, Mendoza, Lima…"
        maxLength={120}
        defaultValue={originCity}
      />
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          name="profile_visible"
          defaultChecked={profileVisible}
          className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
        />
        <span>
          Quiero que mi perfil de comunidad (nombre e inicial) pueda verse en las residencias donde viva.{" "}
          <span className="text-ink-faint">Opcional — podés cambiarlo cuando quieras.</span>
        </span>
      </label>

      {state.status === "error" && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
          Guardado.
        </p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
