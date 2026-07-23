"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { updateStudentProfileDetails, type UpdateProfileState } from "@/app/students/profile/actions";
import { computeProfileCompleteness } from "@/lib/students/profileCompleteness";
import { LATAM_COUNTRIES } from "@/lib/data/latamCountries";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";
import { INTEREST_OPTIONS, HABIT_OPTIONS, UNIVERSITY_OTHER_VALUE, BIO_MAX_LENGTH } from "@/lib/students/profileOptions";

const initialState: UpdateProfileState = { status: "idle" };

/**
 * Grupo de chips seleccionables (multi-select) — mismo look que los
 * botones de objetivo académico de `ApplyForm.tsx`, generalizado para
 * Intereses/Hábitos (Ciclo 36). No se extrajo a `components/ui/`
 * porque es la única pantalla que lo necesita hoy — convención del
 * proyecto de no abstraer antes de tener un segundo caller real.
 */
function ChipToggleGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={isSelected}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-300 ${
              isSelected
                ? "animate-select-pop border-forest bg-forest text-white shadow-card"
                : "border-line-2 bg-paper text-ink-soft hover:border-forest hover:text-forest-700"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileDetailsForm({
  nationality,
  studyInstitution,
  originCity,
  bio,
  interests,
  habits,
  profileVisible,
  hasIdentityDocument,
  hasAcademicProofDocument,
}: {
  nationality: string;
  studyInstitution: string;
  originCity: string;
  bio: string;
  interests: string[];
  habits: string[];
  profileVisible: boolean;
  hasIdentityDocument: boolean;
  hasAcademicProofDocument: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateStudentProfileDetails, initialState);

  const isKnownUniversity = UNIVERSITY_NAMES.includes(studyInstitution);
  const [nationalityValue, setNationalityValue] = useState(nationality);
  const [universitySelect, setUniversitySelect] = useState(
    !studyInstitution ? "" : isKnownUniversity ? studyInstitution : UNIVERSITY_OTHER_VALUE,
  );
  const [universityOther, setUniversityOther] = useState(isKnownUniversity ? "" : studyInstitution);
  const [originCityValue, setOriginCityValue] = useState(originCity);
  const [bioValue, setBioValue] = useState(bio);
  const [interestsValue, setInterestsValue] = useState<string[]>(interests);
  const [habitsValue, setHabitsValue] = useState<string[]>(habits);
  const [visibleValue, setVisibleValue] = useState(profileVisible);

  const effectiveInstitution =
    universitySelect === UNIVERSITY_OTHER_VALUE ? universityOther.trim() : universitySelect;

  // Recalculado en vivo con cada cambio (sin guardar todavía) — pedido
  // del dueño: "el progreso debe sentirse vivo y motivar al usuario".
  const completeness = useMemo(
    () =>
      computeProfileCompleteness({
        nationality: nationalityValue || null,
        studyInstitutionPrivate: effectiveInstitution || null,
        originCity: originCityValue || null,
        hasIdentityDocument,
        hasAcademicProofDocument,
        bio: bioValue || null,
        interestsCount: interestsValue.length,
        habitsCount: habitsValue.length,
      }),
    [
      nationalityValue,
      effectiveInstitution,
      originCityValue,
      hasIdentityDocument,
      hasAcademicProofDocument,
      bioValue,
      interestsValue,
      habitsValue,
    ],
  );

  function toggleInterest(value: string) {
    setInterestsValue((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }
  function toggleHabit(value: string) {
    setHabitsValue((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  return (
    <>
      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Perfil completo</span>
          <span
            key={completeness.percent}
            className="animate-select-pop text-sm font-bold text-forest-700"
          >
            {completeness.percent}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sand-200">
          <div
            className="h-full rounded-full bg-forest transition-all duration-500 ease-fresh"
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
        {completeness.percent === 100 ? (
          <p className="benefit-fade-in mt-3 flex items-center gap-2 text-sm font-semibold text-forest-700">
            <Icon name="check_circle" className="text-lg" />
            ¡Tu perfil está completo!
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {completeness.missing.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
                <Icon name="arrow_right_alt" className="mt-0.5 shrink-0 text-sm text-orange-700" />
                {item.message}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form action={formAction}>
        <Card className="mt-4 p-5">
          <h2 className="font-bold text-ink">Datos de tu perfil</h2>
          <p className="mt-1 text-xs text-ink-faint">Privados — nunca se muestran públicamente.</p>
          <div className="mt-3 flex flex-col gap-4">
            <Select
              label="Nacionalidad"
              id="profile-nationality"
              name="nationality"
              value={nationalityValue}
              onChange={(e) => setNationalityValue(e.target.value)}
            >
              <option value="">Elegí un país</option>
              {LATAM_COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </Select>

            <div>
              <Select
                label="¿Dónde vas a estudiar?"
                id="profile-institution"
                name="study_institution_select"
                hint="Nos ayuda a mostrarte residencias bien ubicadas."
                value={universitySelect}
                onChange={(e) => setUniversitySelect(e.target.value)}
              >
                <option value="">Elegí tu universidad</option>
                {UNIVERSITY_NAMES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value={UNIVERSITY_OTHER_VALUE}>Otra universidad…</option>
              </Select>
              {universitySelect === UNIVERSITY_OTHER_VALUE && (
                <div className="benefit-fade-in mt-2.5">
                  <Input
                    id="profile-institution-other"
                    name="study_institution_other"
                    placeholder="Nombre de tu universidad"
                    maxLength={160}
                    value={universityOther}
                    onChange={(e) => setUniversityOther(e.target.value)}
                  />
                </div>
              )}
            </div>

            <Input
              label="Ciudad de origen (opcional)"
              id="profile-origin-city"
              name="origin_city"
              placeholder="Ej: Córdoba, Mendoza, Lima…"
              maxLength={120}
              value={originCityValue}
              onChange={(e) => setOriginCityValue(e.target.value)}
            />
          </div>
        </Card>

        <Card className="mt-4 p-5">
          <h2 className="font-bold text-ink">Tu perfil de comunidad</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Se muestra a otros estudiantes en tu residencia — solo si activás la visibilidad de abajo.
          </p>

          <div className="mt-4">
            <label htmlFor="profile-bio" className="text-sm font-bold text-ink-soft">
              Sobre mí (opcional)
            </label>
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              Contá un poco sobre vos, cómo sos como compañero de residencia, qué estudiás, tus intereses o
              cualquier información que ayude a conocerte mejor. Evitá repetir datos como tu universidad o
              nacionalidad.
            </p>
            <Textarea
              id="profile-bio"
              name="bio"
              rows={4}
              maxLength={BIO_MAX_LENGTH}
              placeholder="Ej: Estudio Ingeniería y soy bastante tranquilo/a, me gusta cocinar los domingos y siempre tengo mate a mano. Busco un ambiente de estudio, pero también me copa compartir alguna previa de vez en cuando."
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              className="mt-2"
            />
            <p className="mt-1 text-right text-[11px] text-ink-faint">
              {bioValue.length}/{BIO_MAX_LENGTH}
            </p>
          </div>

          <div className="mt-4">
            <span className="text-sm font-bold text-ink-soft">Intereses (opcional)</span>
            <p className="mt-1 text-xs text-ink-faint">
              Elegí los que te representen — ayuda a encontrar compañeros afines.
            </p>
            <div className="mt-2.5">
              <ChipToggleGroup options={INTEREST_OPTIONS} selected={interestsValue} onToggle={toggleInterest} />
            </div>
            <input type="hidden" name="interests" value={interestsValue.join(",")} />
          </div>

          <div className="mt-4">
            <span className="text-sm font-bold text-ink-soft">Hábitos (opcional)</span>
            <p className="mt-1 text-xs text-ink-faint">
              Ayuda a generar mejores convivencias con tus futuros compañeros de residencia.
            </p>
            <div className="mt-2.5">
              <ChipToggleGroup options={HABIT_OPTIONS} selected={habitsValue} onToggle={toggleHabit} />
            </div>
            <input type="hidden" name="habits" value={habitsValue.join(",")} />
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 border-t border-line pt-4 text-sm text-ink">
            <input
              type="checkbox"
              name="profile_visible"
              checked={visibleValue}
              onChange={(e) => setVisibleValue(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
            />
            <span>
              Quiero que mi perfil de comunidad (nombre, inicial, intereses y hábitos) pueda verse en las
              residencias donde viva. <span className="text-ink-faint">Opcional — podés cambiarlo cuando quieras.</span>
            </span>
          </label>
        </Card>

        {state.status === "error" && (
          <p role="alert" className="mt-4 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
            {state.message}
          </p>
        )}
        {state.status === "saved" && (
          <p className="benefit-fade-in mt-4 rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
            Guardado.
          </p>
        )}

        <Button type="submit" variant="outline" disabled={isPending} className="mt-4">
          {isPending ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </>
  );
}
