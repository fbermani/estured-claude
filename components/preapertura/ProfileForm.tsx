"use client";

import { DevAccountNotice } from "@/components/preapertura/DevAccountNotice";
import { BackNav } from "@/components/preapertura/BackNav";
import { startTransition, useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Input, Select } from "@/components/ui/Input";
import { FlagAvatar } from "@/components/residences/FlagAvatar";
import { saveProfile } from "@/app/(preapertura)/preregistro/actions";
import { NETWORK_MESSAGE, type ProfileState } from "@/lib/preapertura/formState";
import {
  ARGENTINA,
  CAREER_OPTIONS,
  COUNTRY_OPTIONS,
  ENTRY_MONTH_OPTIONS,
  HABIT_OPTIONS,
  INTEREST_OPTIONS,
  MAX_CHIPS,
  OTHER_CAREER,
  OTHER_UNIVERSITY,
  PROVINCE_OPTIONS,
  ROOM_TYPE_OPTIONS,
  UNIVERSITY_OPTIONS,
  flagFor,
} from "@/lib/preapertura/options";
import { profileProgress } from "@/lib/preapertura/validation";
import { ChoiceChip } from "@/components/preapertura/ChoiceChip";
import { ProfileCardLive, ProfileMeter, SearchCardLive, type PreviewData } from "@/components/preapertura/ProfilePreview";
import { CheckRow, FormAlert, SubmitButton, errorHint, errorProps, useFocusOnError } from "@/components/preapertura/FormParts";

export type ProfileInitial = {
  firstName: string;
  country: string;
  province: string;
  university: string;
  universityOther: string;
  career: string;
  careerOther: string;
  entry: string;
  roomType: string;
  habits: string[];
  interests: string[];
  inResidence: boolean;
  currentResidence: string;
  community: boolean;
};

const INITIAL_STATE: ProfileState = { status: "idle" };

/**
 * «Completá tu perfil» (DR67): nombre, país, universidad, carrera, mes de ingreso y habitación son obligatorios; hábitos,
 * intereses y comunidad, opcionales. Las tarjetas «Así te van a ver» y
 * «Busca residencia» se arman en vivo: a la derecha y fijas en escritorio; en móvil, un resumen fijo arriba que se despliega.
 * La validación real (listas cerradas, longitudes, 2 hábitos y 2 intereses) es la del servidor. Un menor invitado no puede activar
 * la comunidad: el casillero va deshabilitado («Disponible desde los 18 años»).
 */
export function ProfileForm({ initial, age, isMinor, devAccount = false }: { initial: ProfileInitial; age: number | null; isMinor: boolean; devAccount?: boolean }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ProfileState, FormData>(async (prev, formData) => {
    try {
      return await saveProfile(prev, formData);
    } catch {
      return { status: "error", code: "network", message: NETWORK_MESSAGE };
    }
  }, INITIAL_STATE);

  const [name, setName] = useState(initial.firstName);
  const [country, setCountry] = useState(initial.country);
  const [province, setProvince] = useState(initial.province);
  const [university, setUniversity] = useState(initial.university);
  const [universityOther, setUniversityOther] = useState(initial.universityOther);
  const [career, setCareer] = useState(initial.career);
  const [careerOther, setCareerOther] = useState(initial.careerOther);
  const [entry, setEntry] = useState(initial.entry);
  const [roomType, setRoomType] = useState(initial.roomType);
  const [habits, setHabits] = useState<string[]>(initial.habits);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [inResidence, setInResidence] = useState(initial.inResidence);
  const [currentResidence, setCurrentResidence] = useState(initial.currentResidence);
  const [community, setCommunity] = useState(isMinor ? false : initial.community);

  const failed = state.status === "error";
  const errors = failed ? state.fieldErrors : undefined;
  const hasFieldErrors = Boolean(errors && Object.keys(errors).length > 0);
  const { formRef, alertRef } = useFocusOnError(state, failed);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.replace(state.redirectTo);
  }, [state, router]);

  const isArgentina = country === ARGENTINA;
  const universityShown = university === OTHER_UNIVERSITY ? universityOther.trim() : university;
  const careerShown = career === OTHER_CAREER ? careerOther.trim() : career;
  const provinceShown = isArgentina ? province : "";
  const countryShown = country === "Otro país" ? "otro país" : country;
  const preview: PreviewData = {
    name: name.trim(),
    age,
    from: provinceShown || countryShown,
    flag: flagFor(country),
    career: careerShown,
    tags: [...habits, ...interests],
    fromLong: provinceShown ? `${provinceShown}, Argentina` : countryShown,
    roomType: roomType as PreviewData["roomType"],
    university: universityShown,
    entry,
  };
  const percent = profileProgress({
    name: Boolean(name.trim()),
    country: Boolean(country),
    university: Boolean(universityShown),
    career: Boolean(careerShown),
    entry: Boolean(entry),
    roomType: Boolean(roomType),
    habits: habits.length === MAX_CHIPS,
    interests: interests.length === MAX_CHIPS,
  });

  function toggle(list: string[], setList: (next: string[]) => void, value: string, on: boolean) {
    setList(on ? [...list, value] : list.filter((item) => item !== value));
  }

  const entryLabel = ENTRY_MONTH_OPTIONS.find((o) => o.value === entry)?.label ?? "";
  const roomLabel = ROOM_TYPE_OPTIONS.find((o) => o.value === roomType)?.label ?? "";
  const summary = [roomLabel, preview.university, entryLabel].filter(Boolean).join(", ");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] @min-[1080px]:grid-cols-[minmax(0,1fr)_290px]">
      <div className="p-5 @min-[640px]:px-7 @min-[640px]:py-5">
        <div className="@min-[760px]:flex @min-[760px]:items-center @min-[760px]:gap-4">
          <BackNav href="/mi-lugar">Volver a Mi lugar</BackNav>
          <h1 id="pre-profile-title" className="mt-1 font-display text-3xl leading-tight tracking-tight text-ink @min-[760px]:mt-0 @min-[760px]:text-2xl">
            Completá tu perfil
          </h1>
          <div className="hidden min-w-0 flex-1 @min-[760px]:block [&>div]:mt-0">
            <ProfileMeter percent={percent} />
          </div>
        </div>
        {devAccount && <DevAccountNotice className="mt-1" />}
        <p className="mt-1 text-ink-soft @min-[760px]:hidden">Lo necesitamos para mostrarte residencias que te sirvan.</p>

        {/* Móvil: resumen fijo arriba que se despliega y muestra las dos tarjetas. */}
        <details className="group sticky top-0 z-[3] -mx-5 mt-3 border-b border-line bg-paper px-5 @min-[640px]:-mx-7 @min-[640px]:px-7 @min-[1080px]:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 text-sm text-ink-soft focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink [&::-webkit-details-marker]:hidden">
            <FlagAvatar initial={preview.name ? preview.name[0].toUpperCase() : "?"} flag={preview.flag || undefined} />
            <span className="min-w-0 truncate">
              <b className="text-ink">{preview.name || "Tu tarjeta"}</b>
              {summary ? `, ${summary}` : ""}
            </span>
            <Icon name="expand_more" className="ml-auto text-2xl text-forest-700 transition-transform duration-200 ease-out-fresh group-open:rotate-180" />
          </summary>
          <div className="grid gap-2 pb-3 pt-1.5">
            <ProfileCardLive data={preview} />
            <SearchCardLive data={preview} />
          </div>
        </details>

        <div className="@min-[760px]:hidden">
          <ProfileMeter percent={percent} />
        </div>

        {failed && state.code === "no_session" ? (
          <FormAlert title="Tu sesión venció." alertRef={alertRef} className="mt-3.5">
            <Link href="/login" className="font-bold underline underline-offset-2">
              Ingresá de nuevo
            </Link>{" "}
            para guardar tu perfil.
          </FormAlert>
        ) : failed && state.code === "network" ? (
          <FormAlert icon="wifi_off" title="No pudimos guardar tu perfil." alertRef={alertRef} className="mt-3.5">
            {state.message}
          </FormAlert>
        ) : failed && hasFieldErrors ? (
          <FormAlert title="Revisá los campos marcados." alertRef={alertRef} className="mt-3.5">
            {state.communityRemoved ? "Ya quitamos tu perfil de la comunidad." : null}
          </FormAlert>
        ) : failed ? (
          <FormAlert title={state.message ?? "No pudimos guardar tu perfil."} alertRef={alertRef} className="mt-3.5" />
        ) : null}

        <form
        ref={formRef}
        // Sin `action`: React 19 resetea el formulario al terminar la acción y desmarcaría los casilleros y pastillas controlados.
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        noValidate className="mt-4 grid gap-4 @min-[760px]:grid-cols-2 @min-[760px]:items-start @min-[760px]:gap-x-6 @min-[760px]:gap-y-3">
          <div className="grid min-w-0 content-start gap-3">
          <div className="grid gap-2.5 @min-[560px]:grid-cols-2">
            <Input
              id="pre-first_name"
              name="first_name"
              label="Nombre"
              required
              autoComplete="given-name"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              hint={errorHint(errors, "first_name", "pre")}
              {...errorProps(errors, "first_name", "pre")}
            />
            <Select
              id="pre-country"
              name="country"
              label="¿De dónde sos?"
              required
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                if (event.target.value !== ARGENTINA) setProvince("");
              }}
              hint={errorHint(errors, "country", "pre")}
              {...errorProps(errors, "country", "pre")}
            >
              <option value="">Elegí un país</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
            {isArgentina && (
              <Select
                id="pre-province"
                name="province"
                label="Provincia"
                value={province}
                onChange={(event) => setProvince(event.target.value)}
                hint={errorHint(errors, "province", "pre")}
                className="@min-[560px]:col-span-2"
                {...errorProps(errors, "province", "pre")}
              >
                <option value="">Elegí tu provincia</option>
                {PROVINCE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
            <Select
              id="pre-university"
              name="university"
              label="Universidad"
              required
              value={university}
              onChange={(event) => setUniversity(event.target.value)}
              hint={errorHint(errors, "university", "pre")}
              {...errorProps(errors, "university", "pre")}
            >
              <option value="">Elegí tu universidad</option>
              {UNIVERSITY_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value={OTHER_UNIVERSITY}>Otra…</option>
            </Select>
            <Select
              id="pre-career"
              name="career"
              label="Carrera"
              required
              value={career}
              onChange={(event) => setCareer(event.target.value)}
              hint={errorHint(errors, "career", "pre")}
              {...errorProps(errors, "career", "pre")}
            >
              <option value="">Elegí tu carrera</option>
              {CAREER_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={OTHER_CAREER}>Otra…</option>
            </Select>
            {university === OTHER_UNIVERSITY && (
              <Input
                id="pre-university_other"
                name="university_other"
                label="¿Qué universidad?"
                required
                maxLength={120}
                autoComplete="off"
                autoCapitalize="words"
                value={universityOther}
                onChange={(event) => setUniversityOther(event.target.value)}
                hint={errorHint(errors, "university_other", "pre")}
                className="col-start-1"
                {...errorProps(errors, "university_other", "pre")}
              />
            )}
            {career === OTHER_CAREER && (
              <Input
                id="pre-career_other"
                name="career_other"
                label="¿Qué carrera?"
                required
                maxLength={120}
                autoComplete="off"
                autoCapitalize="sentences"
                value={careerOther}
                onChange={(event) => setCareerOther(event.target.value)}
                hint={errorHint(errors, "career_other", "pre")}
                className="@min-[560px]:col-start-2"
                {...errorProps(errors, "career_other", "pre")}
              />
            )}
          </div>

          <Group legend="¿Cuándo querés entrar?" error={errors?.entry} id="entry">
            {ENTRY_MONTH_OPTIONS.map((o) => (
              <ChoiceChip key={o.value} type="radio" name="entry" value={o.value} required checked={entry === o.value} onChange={() => setEntry(o.value)}>
                {o.label}
              </ChoiceChip>
            ))}
          </Group>

          <Group legend="Tipo de habitación" error={errors?.room_type} id="room_type">
            {ROOM_TYPE_OPTIONS.map((o) => (
              <ChoiceChip key={o.value} type="radio" name="room_type" value={o.value} required checked={roomType === o.value} onChange={() => setRoomType(o.value)}>
                {o.label}
              </ChoiceChip>
            ))}
          </Group>

          <div className="flex flex-wrap items-end gap-3">
            <Group legend="¿Ya estás en una residencia?" id="in_residence">
              <ChoiceChip type="radio" name="in_residence" value="no" checked={!inResidence} onChange={() => setInResidence(false)}>
                No
              </ChoiceChip>
              <ChoiceChip type="radio" name="in_residence" value="si" checked={inResidence} onChange={() => setInResidence(true)}>
                Sí
              </ChoiceChip>
            </Group>
            {inResidence && (
              <Input
                id="pre-current_residence"
                name="current_residence"
                label="Residencia"
              className="min-w-[220px] flex-1"
                maxLength={120}
                autoComplete="off"
                value={currentResidence}
                onChange={(event) => setCurrentResidence(event.target.value)}
                hint={errorHint(errors, "current_residence", "pre")}
                {...errorProps(errors, "current_residence", "pre")}
              />
            )}
          </div>
          </div>

          <div className="grid min-w-0 content-start gap-3">
          <p className="text-sm text-ink-soft">Hábitos, intereses y aparecer en la comunidad son opcionales.</p>

          <Group legend="Tus hábitos" hint="Elegí 2" error={errors?.habits} id="habits">
            {HABIT_OPTIONS.map((h) => {
              const checked = habits.includes(h);
              return (
                <ChoiceChip
                  key={h}
                  type="checkbox"
                  name="habits"
                  value={h}
                  checked={checked}
                  disabled={!checked && habits.length >= MAX_CHIPS}
                  onChange={(on) => toggle(habits, setHabits, h, on)}
                >
                  {h}
                </ChoiceChip>
              );
            })}
          </Group>

          <Group legend="Tus intereses" hint="Elegí 2" error={errors?.interests} id="interests">
            {INTEREST_OPTIONS.map((i) => {
              const checked = interests.includes(i);
              return (
                <ChoiceChip
                  key={i}
                  type="checkbox"
                  name="interests"
                  value={i}
                  checked={checked}
                  disabled={!checked && interests.length >= MAX_CHIPS}
                  onChange={(on) => toggle(interests, setInterests, i, on)}
                >
                  {i}
                </ChoiceChip>
              );
            })}
          </Group>

          <CheckRow
            name="community"
            checked={community}
            onChange={setCommunity}
            disabled={isMinor}
            describedBy={isMinor ? "pre-community-note" : undefined}
            className="border-[1.5px] border-line-2 bg-cream p-3 text-sm font-semibold text-ink"
          >
            Mostrar mi perfil (nombre, edad, país, carrera, hábitos e intereses) en la comunidad de la web
            {isMinor && (
              <small id="pre-community-note" className="block text-[13px] font-normal text-ink-faint">
                Disponible desde los 18 años.
              </small>
            )}
          </CheckRow>
          <div className="flex @min-[760px]:justify-end">
            <SubmitButton isPending={isPending}
              block={false}
              idle={
                <>
                  Guardar mi perfil
                  <Icon name="arrow_forward" className="text-xl" />
                </>
              }
              pending="Guardando…"
            />
          </div>
          </div>
        </form>
      </div>

      {/* Escritorio: columna derecha fija con las dos tarjetas en vivo. */}
      <aside aria-label="Vista previa" className="hidden border-l border-line bg-cream p-5 @min-[1080px]:block">
        <div className="sticky top-5 grid content-start gap-2.5">
          <p className="text-sm font-bold text-ink-soft">Así te van a ver</p>
          <ProfileCardLive data={preview} />
          <p className="mt-1.5 text-sm font-bold text-ink-soft">Lo que buscás</p>
          <SearchCardLive data={preview} />
          <p className="text-sm text-ink-soft" aria-live="polite">
            {isMinor
              ? "Tu perfil no aparece en la comunidad: se activa desde los 18 años."
              : community
                ? "Tu tarjeta va a aparecer en la comunidad de la web."
                : "Tu tarjeta aparece en la comunidad si tildás la casilla."}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Group({ legend, hint, error, id, children }: { legend: string; hint?: string; error?: string; id: string; children: ReactNode }) {
  const errorId = `pre-${id}-error`;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 p-0 text-sm font-bold text-ink">
        {legend}
        {hint && <small className="ml-1.5 font-semibold text-orange-700">{hint}</small>}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-danger-fg">
          <Icon name="error" className="text-lg" />
          {error}
        </p>
      )}
    </fieldset>
  );
}
