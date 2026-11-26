/**
 * Carrusel público de comunidad (DR44). Módulo PURO (sin base ni `server-only`) para poder testear la regla de privacidad:
 * una tarjeta real muestra SOLO nombre de pila, edad, país, carrera, hábitos e intereses de un estudiante de 18+ que tildó el casillero
 * de comunidad. Nunca apellido, residencia actual, universidad, provincia, email, fecha de nacimiento ni ningún id.
 */
import { ageByBirthDate } from "@/lib/students/isMinorByBirthDate";
import { ADULT_AGE } from "@/lib/preapertura/validation";
import { EXAMPLE_PROFILES, examplesToShow, type ExampleProfile } from "@/lib/preapertura/rules";
import { CAREER_OPTIONS, COUNTRY_OPTIONS, HABIT_OPTIONS, INTEREST_OPTIONS, flagFor } from "@/lib/preapertura/options";

/**
 * ÚNICAS columnas que la consulta del carrusel pide (lista blanca). `birth_date` se pide solo para calcular la edad en el servidor y
 * se descarta en `toRailCard`: nunca viaja al navegador. Cualquier columna nueva acá es una decisión de privacidad (ver el test).
 */
export const RAIL_COLUMNS = ["first_name", "birth_date", "country", "career", "habits", "interests", "created_at"] as const;

/** Lo que la tarjeta real puede mostrar. Exactamente estas claves. */
export const RAIL_CARD_KEYS = ["kind", "name", "age", "country", "flag", "career", "tags", "tone"] as const;

export type RailTone = ExampleProfile["tone"];

export type RailCard = {
  kind: "real" | "example";
  name: string;
  age: number;
  country: string | null;
  flag: string;
  career: string | null;
  tags: string[];
  tone: RailTone;
};

const TONES: RailTone[] = ["mint", "sky", "peach", "lilac", "butter"];
const MAX_TAGS = 2;

type RawRow = Record<string, unknown>;

/** Solo valores de la lista cerrada: el texto libre que alguien haya escrito nunca llega a una tarjeta pública. */
function onlyFrom(value: unknown, allowed: readonly string[]): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && allowed.includes(v)) : [];
}

/** Carrera pública: de la lista cerrada o «Otra» (el texto libre de «Otra carrera…» NO se muestra jamás). */
function publicCareer(raw: unknown): string | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  return (CAREER_OPTIONS as readonly string[]).includes(text) ? text : "Otra";
}

/** Solo el primer nombre: aunque alguien escriba «Lucía Pérez» en el campo de nombre, el apellido no sale. */
export function firstNameOnly(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  return text.split(/\s+/)[0] ?? "";
}

/**
 * Convierte una fila de la base en tarjeta pública, o `null` si no corresponde mostrarla (sin nombre, sin edad o menor de 18).
 * Copia SOLO los campos permitidos: el resto de la fila (apellido, residencia actual, ids…) se ignora aunque llegara.
 */
export function toRailCard(row: RawRow, index: number, now: Date = new Date()): RailCard | null {
  const name = firstNameOnly(row.first_name);
  if (!name) return null;
  const age = typeof row.birth_date === "string" ? ageByBirthDate(row.birth_date, now) : null;
  if (age == null || age < ADULT_AGE) return null;
  const countryRaw = typeof row.country === "string" ? row.country.trim() : "";
  // «Otro país» no se muestra (no dice nada y no tiene bandera).
  const country = countryRaw !== "Otro país" && COUNTRY_OPTIONS.some((c) => c.name === countryRaw) ? countryRaw : null;
  const career = publicCareer(row.career);
  // Primero un hábito y un interés (variedad), después el resto, hasta `MAX_TAGS` pastillas.
  const habits = onlyFrom(row.habits, HABIT_OPTIONS);
  const interests = onlyFrom(row.interests, INTEREST_OPTIONS);
  const mixed = [habits[0], interests[0], habits[1], interests[1]].filter((t): t is string => Boolean(t));
  return {
    kind: "real",
    name,
    age,
    country,
    flag: flagFor(country),
    career,
    tags: mixed.slice(0, MAX_TAGS),
    tone: TONES[index % TONES.length],
  };
}

export function exampleToCard(example: ExampleProfile): RailCard {
  return {
    kind: "example",
    name: example.name,
    age: example.age,
    country: example.from,
    flag: example.flag,
    career: example.career,
    tags: [...example.tags],
    tone: example.tone,
  };
}

/** Título de la sección (DR67 h): con algún perfil ficticio es una vista previa; «Se están sumando» solo con todo real. */
export function railTitle(hasExamples: boolean): string {
  return hasExamples ? "Así vas a ver a tus posibles compañeros" : "Se están sumando";
}

/**
 * Arma la tira: primero los reales (más nuevos primero) y, mientras falten, los ficticios (DR44.3): cada real retira uno y con
 * `EXAMPLES_OFF_AT` reales no queda ninguno.
 */
export function buildRail(realCards: RailCard[]): { cards: RailCard[]; hasExamples: boolean; realCount: number } {
  const examples = EXAMPLE_PROFILES.slice(0, examplesToShow(realCards.length)).map(exampleToCard);
  return { cards: [...realCards, ...examples], hasExamples: examples.length > 0, realCount: realCards.length };
}
