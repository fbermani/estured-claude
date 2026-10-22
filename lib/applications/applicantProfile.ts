import { redactContactInfo } from "@/lib/text/redactContactInfo";
import { formatInitial, formatShortName } from "@/lib/format/shortName";
import { ageByBirthDate, isMinorByBirthDate } from "@/lib/students/isMinorByBirthDate";

/**
 * Ciclo 51 (D32) — "Quién solicita": lo que la residencia ve del perfil del
 * estudiante en el inbox, ANTES de establecer contacto (docs/10 §7.5 y §9).
 *
 * Lógica PURA (sin `server-only`, sin base de datos) para poder testear la
 * regla de privacidad. Corre en el servidor: al cliente solo viaja el
 * resultado (`ApplicantProfileView`), nunca la fila cruda del perfil.
 *
 * Reglas:
 * - NUNCA entran acá: apellido completo, fecha de nacimiento, DNI,
 *   documentos, teléfono ni email (llegan al residente recién al establecer
 *   contacto, por los canales ya existentes).
 * - Adulto: nombre + inicial, edad, carrera, universidad, origen (ciudad/país).
 *   La presentación ("Sobre mí"), los hábitos y los intereses solo se ven si
 *   el estudiante los eligió compartir: interruptor maestro
 *   `is_individual_profile_visible` + el interruptor propio de cada dato
 *   (`show_habits_to_registered` / `show_interests_to_registered`). Sin
 *   configuración de visibilidad (fila inexistente) no se comparte nada.
 * - Texto libre (presentación, hábitos, intereses): se pasa por
 *   `redactContactInfo` — teléfonos, emails, links y usuarios de redes se
 *   reemplazan, para que no sirvan de contacto previo al contacto.
 * - Menor (por fecha de nacimiento, no por el flag; sin fecha = se trata con
 *   las mismas restricciones, pero SIN afirmar que es menor):
 *   solo nombre + inicial, edad y carrera. Sin universidad, origen,
 *   presentación, hábitos ni intereses, aunque estén cargados o los
 *   interruptores figuren prendidos (docs/10 §9.2). El objetivo y las fechas
 *   salen de la solicitud, no del perfil.
 */

export type ApplicantProfileSource = {
  first_name: string | null;
  last_initial: string | null;
  birth_date: string | null;
  display_age: number | null;
  is_minor: boolean | null;
  nationality: string | null;
  origin_city: string | null;
  origin_country: string | null;
  career: string | null;
  study_institution_private: string | null;
  bio: string | null;
  habits: unknown;
  interests: unknown;
  student_visibility_settings:
    | {
        is_individual_profile_visible: boolean | null;
        show_habits_to_registered: boolean | null;
        show_interests_to_registered: boolean | null;
      }
    | null
    | undefined;
};

export type ApplicantNotShared = "bio" | "habits" | "interests";

export type ApplicantProfileView = {
  /** "Camila R." */
  displayName: string;
  /** Inicial para el avatar (no hay foto: no existe flujo de carga). */
  avatarInitial: string;
  /** Menor confirmado: fecha de nacimiento de menor o `is_minor = true`. */
  isMinor: boolean;
  /** Sin fecha de nacimiento válida (y sin `is_minor`): se muestran solo los datos básicos, sin afirmar que es menor. */
  birthDateMissing: boolean;
  /** La solicitud la gestiona el familiar vinculado (menor, o contacto dirigido a familiar). */
  managedByFamily: boolean;
  age: number | null;
  career: string | null;
  university: string | null;
  /** "Rosario, Argentina" (o la nacionalidad si no hay ciudad/país). */
  origin: string | null;
  bio: string | null;
  habits: string[];
  interests: string[];
  /** Datos que el estudiante eligió NO compartir (solo adultos). Vacío para menores: ahí hay un aviso aparte. */
  notShared: ApplicantNotShared[];
};

const MAX_ITEMS = 30;
const MAX_ITEM_LENGTH = 60;
const MAX_BIO_LENGTH = 500;

/** `{ items: [...] }` (así los guarda el perfil) o un array directo → lista de textos cortos y limpios. */
export function readProfileItems(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : (value as { items?: unknown } | null | undefined)?.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, MAX_ITEM_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

function redactItems(items: string[]): string[] {
  return [...new Set(items.map((i) => redactContactInfo(i)))];
}

function clean(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

export function buildApplicantProfile(
  profile: ApplicantProfileSource | null | undefined,
  options: { contactTarget: string; now?: Date },
): ApplicantProfileView {
  if (!profile) {
    return {
      displayName: "Estudiante",
      avatarInitial: "E",
      isMinor: false,
      birthDateMissing: false,
      managedByFamily: options.contactTarget === "family_member",
      age: null,
      career: null,
      university: null,
      origin: null,
      bio: null,
      habits: [],
      interests: [],
      notShared: [],
    };
  }

  const hasBirthDate = ageByBirthDate(profile.birth_date, options.now) !== null;
  // Menor confirmado: fecha de menor o flag. Sin fecha válida NO se afirma que sea menor (solo se restringe).
  const isMinor = (hasBirthDate && isMinorByBirthDate(profile.birth_date, options.now)) || profile.is_minor === true;
  const birthDateMissing = !hasBirthDate && !isMinor;
  const displayName = formatShortName(profile.first_name, profile.last_initial) || "Estudiante";
  const avatarInitial = (profile.first_name ?? "").trim().charAt(0).toUpperCase() || formatInitial(profile.last_initial).charAt(0) || "E";
  const age = ageByBirthDate(profile.birth_date, options.now) ?? profile.display_age ?? null;
  const base = {
    displayName,
    avatarInitial,
    isMinor,
    birthDateMissing,
    managedByFamily: isMinor || options.contactTarget === "family_member",
    age,
    career: clean(profile.career),
  };

  if (isMinor || birthDateMissing) {
    return { ...base, university: null, origin: null, bio: null, habits: [], interests: [], notShared: [] };
  }

  const settings = profile.student_visibility_settings;
  const masterOn = settings?.is_individual_profile_visible === true;
  const bioShared = masterOn;
  const habitsShared = masterOn && settings?.show_habits_to_registered === true;
  const interestsShared = masterOn && settings?.show_interests_to_registered === true;

  const bioClean = bioShared ? clean(profile.bio)?.slice(0, MAX_BIO_LENGTH) : undefined;
  const bio = bioClean ? redactContactInfo(bioClean) : null;
  const habits = habitsShared ? redactItems(readProfileItems(profile.habits)) : [];
  const interests = interestsShared ? redactItems(readProfileItems(profile.interests)) : [];

  const notShared: ApplicantNotShared[] = [];
  if (!bioShared) notShared.push("bio");
  if (!habitsShared) notShared.push("habits");
  if (!interestsShared) notShared.push("interests");

  const city = clean(profile.origin_city);
  const country = clean(profile.origin_country) ?? clean(profile.nationality);
  const origin = [city, country].filter(Boolean).join(", ") || null;

  return {
    ...base,
    university: clean(profile.study_institution_private),
    origin,
    bio,
    habits,
    interests,
    notShared,
  };
}
