"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useLiveProfile } from "@/app/students/profile/LiveProfile";
import { FLAG_BY_COUNTRY } from "@/lib/data/latamCountries";
import { updateCommunityVisibility, type CommunityVisibilityState } from "@/app/students/profile/actions";
import {
  MINOR_VISIBILITY_MESSAGE,
  buildCommunityPreview,
  type CommunityPreviewData,
  type VisibilityValues,
} from "@/lib/students/communityVisibilitySettings";

const initialState: CommunityVisibilityState = { status: "idle" };

const FIELD_TOGGLES = [
  { name: "show_age", label: "Edad", help: "Tu edad, no tu fecha de nacimiento." },
  { name: "show_nationality", label: "Nacionalidad", help: "Tu país y su bandera." },
  { name: "show_career_origin", label: "Carrera y ciudad de origen", help: "Qué estudiás y de dónde sos." },
  { name: "show_habits_interests", label: "Hábitos e intereses", help: "Los que elegiste en tu perfil." },
] as const;

type ToggleName = (typeof FIELD_TOGGLES)[number]["name"] | "community_master";

function Switch({
  name,
  checked,
  onChange,
  disabled,
  label,
  help,
  strong = false,
}: {
  name: ToggleName;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  help: string;
  strong?: boolean;
}) {
  const id = `community-${name}`;
  return (
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-4 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className="min-w-0">
        <span className={`block text-sm ${strong ? "font-bold" : "font-semibold"} text-ink`}>{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{help}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line-2 transition-colors duration-200 ease-fresh peer-checked:bg-forest peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-paper after:shadow-sm after:transition-transform after:duration-200 after:content-[''] peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function Preview({ isMinor, values, data }: { isMinor: boolean; values: VisibilityValues; data: CommunityPreviewData }) {
  const preview = buildCommunityPreview({ isMinor, values, data });
  return (
    <div className="rounded-field border border-line-2 bg-cream-2 p-4" aria-live="polite">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Así te ve otro usuario registrado</p>
      {preview.kind === "placeholder" ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-200 text-ink-faint">
            <Icon name="person" className="text-xl" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Plaza ocupada</p>
            <p className="text-xs text-ink-faint">Nadie ve tu nombre ni tus datos.</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-tint text-sm font-bold text-forest-700">
            {preview.firstName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {preview.firstName}
              {preview.age !== null && <span className="font-normal text-ink-soft">, {preview.age}</span>}
            </p>
            <p className="text-xs text-ink-soft">
              {[
                preview.nationality ? `${preview.countryFlag ?? ""} ${preview.nationality}`.trim() : null,
                preview.career,
                preview.originCity,
              ]
                .filter(Boolean)
                .join(" · ") || "Solo tu nombre"}
            </p>
            {preview.bio && <p className="mt-2 text-xs italic leading-relaxed text-ink-soft">&ldquo;{preview.bio}&rdquo;</p>}
            {([
              { label: "Hábitos", icon: "schedule", items: preview.habits },
              { label: "Intereses", icon: "interests", items: preview.interests },
            ] as const).map(
              (group) =>
                group.items.length > 0 && (
                  <div key={group.label} className="mt-2.5">
                    <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      <Icon name={group.icon} className="text-sm" />
                      {group.label}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {group.items.map((t) => (
                        <span key={t} className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CommunityVisibilityCard({
  isMinor,
  initial,
  data,
}: {
  isMinor: boolean;
  initial: VisibilityValues;
  data: CommunityPreviewData;
}) {
  const [state, formAction, isPending] = useActionState(updateCommunityVisibility, initialState);
  // Vista previa en vivo: lo que se está escribiendo arriba pisa lo guardado (la bandera sale del país elegido).
  const liveValues = useLiveProfile()?.live ?? null;
  const previewData: CommunityPreviewData = liveValues
    ? { ...data, ...liveValues, countryFlag: liveValues.nationality ? (FLAG_BY_COUNTRY[liveValues.nationality] ?? null) : null }
    : data;
  const initialMaster = initial.is_individual_profile_visible && !isMinor;
  const initialFields = {
    show_age: initial.show_age_to_registered,
    show_nationality: initial.show_nationality_to_registered,
    show_career_origin: initial.show_career_to_registered || initial.show_origin_city_to_registered,
    show_habits_interests: initial.show_habits_to_registered || initial.show_interests_to_registered,
  };
  const [master, setMaster] = useState(initialMaster);
  const [fields, setFields] = useState<Record<(typeof FIELD_TOGGLES)[number]["name"], boolean>>(initialFields);

  // Si la action devuelve error (p. ej. no se pudo registrar el consentimiento
  // y se revirtió en base), los interruptores vuelven a lo guardado para no
  // quedar "prendidos" mientras el mensaje dice que sigue oculto.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error") {
      setMaster(initialMaster);
      setFields(initialFields);
    }
  }

  const live: VisibilityValues = {
    is_individual_profile_visible: master,
    show_age_to_registered: fields.show_age,
    show_nationality_to_registered: fields.show_nationality,
    show_career_to_registered: fields.show_career_origin,
    show_origin_city_to_registered: fields.show_career_origin,
    show_habits_to_registered: fields.show_habits_interests,
    show_interests_to_registered: fields.show_habits_interests,
  };

  // Se envía a mano (no con `action={formAction}`) para que React 19 no
  // resetee el formulario al terminar y desincronice los interruptores
  // controlados del estado real.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <Card className="mt-4 p-5">
      <div id="comunidad" className="flex items-center gap-2 scroll-mt-24">
        <Icon name="groups" className="text-xl text-forest-700" />
        <h2 className="font-bold text-ink">Tu perfil en la comunidad</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">
        Cuando te alojes, los demás usuarios registrados pueden ver tu perfil en la comunidad de tu residencia. Vos
        decidís si aparecés y qué se ve. Podés cambiarlo cuando quieras.
      </p>

      {isMinor && (
        <p className="mt-3 flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-3 text-sm leading-relaxed text-info-fg">
          <Icon name="shield_person" className="mt-0.5 shrink-0 text-lg" />
          <span>{MINOR_VISIBILITY_MESSAGE} Mientras tanto, solo se muestra que la plaza está ocupada.</span>
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 grid gap-5 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <Switch
            name="community_master"
            checked={master}
            onChange={setMaster}
            disabled={isMinor}
            strong
            label="Aparecer en la comunidad de mi residencia"
            help="Si lo apagás, solo se ve que hay una plaza ocupada. Tu nombre y tus datos no se muestran."
          />
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-xs font-semibold text-ink-soft">Qué ven los demás usuarios registrados</p>
            {FIELD_TOGGLES.map((t) => (
              <Switch
                key={t.name}
                name={t.name}
                checked={fields[t.name]}
                onChange={(next) => setFields((prev) => ({ ...prev, [t.name]: next }))}
                disabled={isMinor || !master}
                label={t.label}
                help={t.help}
              />
            ))}
            <p className="text-xs leading-relaxed text-ink-faint">
              Tu nombre de pila y tu texto «Sobre mí» se ven cuando aparecés. Tu apellido, email, teléfono, fecha de
              nacimiento, universidad y documentos nunca se muestran.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Preview isMinor={isMinor} values={live} data={previewData} />
          <p className="text-[11px] leading-relaxed text-ink-faint">
            La vista previa se actualiza en vivo con lo que cargás arriba. Para que quede así en tu perfil, guardá los cambios de arriba.
          </p>
        </div>

        <div className="md:col-span-2">
          {state.status === "error" && (
            <p role="alert" className="mb-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
              {state.message}
            </p>
          )}
          {state.status === "saved" && (
            <p className="benefit-fade-in mb-3 rounded-field bg-mint px-4 py-3 text-sm font-medium text-forest-700">
              {state.message ?? "Guardado."}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={isPending || isMinor}>
            {isPending ? "Guardando…" : "Guardar visibilidad"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
