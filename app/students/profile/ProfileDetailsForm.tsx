"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useLiveProfile } from "@/app/students/profile/LiveProfile";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { updateStudentProfileDetails, type UpdateProfileState } from "@/app/students/profile/actions";
import { computeProfileCompleteness } from "@/lib/students/profileCompleteness";
import { LATAM_COUNTRIES, OTHER_COUNTRIES } from "@/lib/data/latamCountries";
import { UNIVERSITY_NAMES } from "@/lib/data/buenosAiresUniversities";
import {
  INTEREST_OPTIONS,
  HABIT_OPTIONS,
  CAREER_OPTIONS,
  UNIVERSITY_OTHER_VALUE,
  CAREER_OTHER_VALUE,
  BIO_MAX_LENGTH,
} from "@/lib/students/profileOptions";

const initialState: UpdateProfileState = { status: "idle" };

const BIO_EXAMPLES = [
  "Soy bastante tranquilo, madrugador y me gusta cocinar los domingos. Busco un ambiente de estudio, pero también me copa compartir un mate de vez en cuando.",
  "Estudiosa pero sociable, disfruto ver series con amigos y siempre tengo la heladera con algo casero. Valoro mucho el orden en los espacios comunes.",
];

function bioHint(length: number): string {
  if (length === 0) return "Empezá contando cómo sos como compañero de residencia.";
  if (length < 40) return "Vas bien — sumá algo de tu rutina o tu forma de ser.";
  if (length < 120) return "¡Buen arranque! Un poco más y se siente más auténtico.";
  return "¡Buen perfil! Así te conocen mejor tus futuros compañeros.";
}

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
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out-fresh hover:scale-[1.04] ${
              isSelected
                ? "animate-select-pop border-forest bg-forest text-white shadow-card"
                : "border-line-2 bg-paper text-ink-soft hover:border-forest hover:bg-forest-tint/40 hover:text-forest-700 hover:shadow-sm"
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
  career,
  originCity,
  bio,
  interests,
  habits,
  hasIdentityDocument,
  hasAcademicProofDocument,
}: {
  nationality: string;
  studyInstitution: string;
  career: string;
  originCity: string;
  bio: string;
  interests: string[];
  habits: string[];
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

  const isKnownCareer = (CAREER_OPTIONS as readonly string[]).includes(career);
  const [careerSelect, setCareerSelect] = useState(
    !career ? "" : isKnownCareer ? career : CAREER_OTHER_VALUE,
  );
  const [careerOther, setCareerOther] = useState(isKnownCareer ? "" : career);
  const [originCityValue, setOriginCityValue] = useState(originCity);
  const [bioValue, setBioValue] = useState(bio);
  const [showBioExamples, setShowBioExamples] = useState(false);
  const [interestsValue, setInterestsValue] = useState<string[]>(interests);
  const [habitsValue, setHabitsValue] = useState<string[]>(habits);

  const effectiveInstitution =
    universitySelect === UNIVERSITY_OTHER_VALUE ? universityOther.trim() : universitySelect;
  const effectiveCareer = careerSelect === CAREER_OTHER_VALUE ? careerOther.trim() : careerSelect;

  // Recalculado en vivo con cada cambio (sin guardar todavía) — pedido
  // del dueño: "el progreso debe sentirse vivo y motivar al usuario".
  const completeness = useMemo(
    () =>
      computeProfileCompleteness({
        nationality: nationalityValue || null,
        studyInstitutionPrivate: effectiveInstitution || null,
        career: effectiveCareer || null,
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
      effectiveCareer,
      originCityValue,
      hasIdentityDocument,
      hasAcademicProofDocument,
      bioValue,
      interestsValue,
      habitsValue,
    ],
  );

  // La vista previa de «Tu perfil en la comunidad» (más abajo) se actualiza con lo que se escribe, sin esperar al guardado.
  const liveProfile = useLiveProfile();
  const setLive = liveProfile?.setLive;
  useEffect(() => {
    setLive?.({
      nationality: nationalityValue || null,
      career: effectiveCareer || null,
      originCity: originCityValue.trim() || null,
      bio: bioValue.trim() || null,
      habits: habitsValue,
      interests: interestsValue,
    });
  }, [setLive, nationalityValue, effectiveCareer, originCityValue, bioValue, habitsValue, interestsValue]);

  function toggleInterest(value: string) {
    setInterestsValue((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }
  function toggleHabit(value: string) {
    setHabitsValue((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Perfil completo</span>
          <span key={completeness.percent} className="animate-select-pop text-sm font-bold text-forest-700">
            {completeness.percent}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sand-200">
          <div
            className="h-full w-full origin-left rounded-full bg-forest transition-transform duration-300 ease-out-fresh"
            style={{ transform: `scaleX(${completeness.percent / 100})` }}
          />
        </div>
        {completeness.percent === 100 ? (
          <p className="benefit-fade-in mt-3 flex items-center gap-2 text-sm font-semibold text-forest-700">
            <Icon name="check_circle" className="text-lg" />
            ¡Tu perfil está completo!
          </p>
        ) : (
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
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
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Nacionalidad"
              id="profile-nationality"
              name="nationality"
              value={nationalityValue}
              onChange={(e) => setNationalityValue(e.target.value)}
            >
              <option value="">Elegí un país</option>
              <optgroup label="Latinoamérica">
                {LATAM_COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Resto del mundo">
                {OTHER_COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </optgroup>
            </Select>

            <Input
              label="Ciudad de origen (opcional)"
              id="profile-origin-city"
              name="origin_city"
              placeholder="Ej: Córdoba, Mendoza, Lima…"
              maxLength={120}
              value={originCityValue}
              onChange={(e) => setOriginCityValue(e.target.value)}
            />

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

            <div>
              <Select
                label="¿Qué carrera?"
                id="profile-career"
                name="career_select"
                value={careerSelect}
                onChange={(e) => setCareerSelect(e.target.value)}
              >
                <option value="">Elegí tu carrera</option>
                {CAREER_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={CAREER_OTHER_VALUE}>Otra carrera…</option>
              </Select>
              {careerSelect === CAREER_OTHER_VALUE && (
                <div className="benefit-fade-in mt-2.5">
                  <Input
                    id="profile-career-other"
                    name="career_other"
                    placeholder="Nombre de tu carrera"
                    maxLength={100}
                    value={careerOther}
                    onChange={(e) => setCareerOther(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card className="mt-4 p-5">
          <h2 className="font-bold text-ink">Sobre vos y tu convivencia</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Quién ve esto lo elegís vos más abajo, en «Tu perfil en la comunidad».
          </p>

          {/* "Sobre mí" — tratamiento destacado (Ciclo 37): jerarquía
              visual propia, ayuda + ejemplos + sugerencia en vivo, no
              un textarea suelto más. */}
          <div className="mt-4 rounded-card border border-line-2 bg-cream p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
                <Icon name="auto_awesome" className="text-lg" />
              </span>
              <div>
                <label htmlFor="profile-bio" className="text-sm font-bold text-ink">
                  Sobre mí
                </label>
                <p className="text-xs text-ink-faint">Lo primero que van a leer de vos</p>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-2 rounded-field border-l-4 border-forest bg-forest-tint/30 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
              <Icon name="lightbulb" className="mt-0.5 shrink-0 text-sm text-forest-700" />
              Contá cómo sos como compañero de residencia, qué te gusta hacer, cómo es tu rutina o cualquier
              aspecto que ayude a conocerte mejor. Evitá repetir información como tu carrera o nacionalidad.
            </p>

            <Textarea
              id="profile-bio"
              name="bio"
              rows={3}
              maxLength={BIO_MAX_LENGTH}
              placeholder="Ej: Soy tranquilo, ordenado y me gusta cocinar los domingos. Busco un ambiente de estudio, pero también me copa compartir un mate de vez en cuando…"
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              className="mt-3 bg-paper"
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-forest-700">{bioHint(bioValue.length)}</p>
              <span className="shrink-0 text-xs text-ink-faint">
                {bioValue.length}/{BIO_MAX_LENGTH}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowBioExamples((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline"
            >
              <Icon name={showBioExamples ? "expand_less" : "expand_more"} className="text-sm" />
              {showBioExamples ? "Ocultar ejemplos" : "Ver ejemplos"}
            </button>
            {showBioExamples && (
              <div className="benefit-fade-in mt-2 space-y-2">
                {BIO_EXAMPLES.map((example) => (
                  <p key={example} className="rounded-field bg-cream-2 px-3 py-2 text-xs italic leading-relaxed text-ink-soft">
                    &ldquo;{example}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              <Icon name="favorite" className="text-base text-forest-700" />
              <span className="text-sm font-bold text-ink">
                Intereses <span className="font-normal text-ink-faint">(opcional)</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Elegí los que te representen — ayuda a encontrar compañeros afines.
            </p>
            <div className="mt-2.5">
              <ChipToggleGroup options={INTEREST_OPTIONS} selected={interestsValue} onToggle={toggleInterest} />
            </div>
            <input type="hidden" name="interests" value={interestsValue.join(",")} />
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              <Icon name="schedule" className="text-base text-forest-700" />
              <span className="text-sm font-bold text-ink">
                Hábitos <span className="font-normal text-ink-faint">(opcional)</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Ayuda a generar mejores convivencias con tus futuros compañeros de residencia.
            </p>
            <div className="mt-2.5">
              <ChipToggleGroup options={HABIT_OPTIONS} selected={habitsValue} onToggle={toggleHabit} />
            </div>
            <input type="hidden" name="habits" value={habitsValue.join(",")} />
          </div>
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
