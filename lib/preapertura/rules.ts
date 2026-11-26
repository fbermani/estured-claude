/**
 * Reglas puras de la preapertura (DR43–DR46, docs/23). Sin base ni `server-only`: se testean directo.
 * Los números salen siempre de datos reales; si la consulta falla se muestra el texto neutro (nunca un número inventado).
 */

/** Cupo real de Residencias fundadoras (DR46.1; 15 desde DR67). PROHIBIDO bajarlo sin altas reales (escasez fabricada). */
export const FOUNDER_CAPACITY = 15;

/** El contador de estudiantes se muestra recién desde 25 registrados (DR43.5): un número chico resta confianza. */
export const STUDENT_COUNTER_MIN = 25;

/** Con 3 o más residencias reales ya se muestra cuántos lugares quedan (DR46.1); antes, solo el texto fijo. */
export const FOUNDER_COUNTER_MIN = 3;

export type StudentCounter = { kind: "number"; count: number } | { kind: "first" };

/** `count` null = no se pudo consultar (tabla sin migrar o error): se cae a «Sé de los primeros». */
export function studentCounter(count: number | null): StudentCounter {
  if (count == null || !Number.isFinite(count) || count < STUDENT_COUNTER_MIN) return { kind: "first" };
  return { kind: "number", count: Math.floor(count) };
}

export type FounderInputs = {
  /** Solicitudes del formulario público que no fueron descartadas (son residencias externas). */
  externalSignups: number;
  /** Residencias en verificación que no vienen de una solicitud (p. ej. las propias). No cuentan como «externas». */
  otherInVerification: number;
};

export type FounderState =
  /** No se pudo consultar: texto fijo, sin números. */
  | { kind: "unknown" }
  /** Sin residencias en proceso, o sin ninguna externa todavía y menos de 3 en total. */
  | { kind: "none" }
  /** Hay al menos una externa y menos de 3 en total: se dice que ya hay residencias, sin mostrar el número. */
  | { kind: "some" }
  /** 3 o más: medidor real. `hasExternal` = al menos una es externa (habilita «Ya hay residencias registrándose»). */
  | { kind: "counted"; taken: number; remaining: number; hasExternal: boolean }
  /** Los lugares del cupo están en proceso (si una no avanza, se libera). */
  | { kind: "full" };

/**
 * Cupo real = solicitudes + residencias en verificación (DR46.1). La frase «ya hay residencias registrándose» solo aparece con
 * la primera residencia EXTERNA (DR46.2): una residencia propia en verificación suma al cupo pero no habilita la frase.
 */
export function founderState(input: FounderInputs | null): FounderState {
  if (!input) return { kind: "unknown" };
  const external = Math.max(0, Math.floor(input.externalSignups));
  const taken = external + Math.max(0, Math.floor(input.otherInVerification));
  if (taken >= FOUNDER_CAPACITY) return { kind: "full" };
  if (taken >= FOUNDER_COUNTER_MIN) return { kind: "counted", taken, remaining: FOUNDER_CAPACITY - taken, hasExternal: external >= 1 };
  if (external >= 1) return { kind: "some" };
  return { kind: "none" };
}

/**
 * Perfiles ficticios del carrusel público (DR44.3, DR67 h): sin rótulo en las fichas; mientras haya alguno, el título de la sección
 * es el de vista previa (`railTitle`). Se retiran con los reales.
 */
export type ExampleProfile = {
  name: string;
  age: number;
  /** País (la tarjeta real también muestra solo el país, nunca la provincia). */
  from: string;
  flag: string;
  career: string;
  tags: readonly [string, string];
  tone: "mint" | "peach" | "lilac" | "sky" | "butter";
};

export const EXAMPLE_PROFILES: readonly ExampleProfile[] = [
  { name: "Martina", age: 19, from: "Uruguay", flag: "🇺🇾", career: "Medicina", tags: ["Madrugo", "Lectura"], tone: "mint" },
  { name: "Joaquín", age: 21, from: "Argentina", flag: "🇦🇷", career: "Ingeniería en Sistemas", tags: ["Hago deporte", "Música"], tone: "sky" },
  { name: "Valeria", age: 20, from: "Perú", flag: "🇵🇪", career: "Arquitectura", tags: ["Me gusta cocinar", "Arte"], tone: "peach" },
  { name: "Tomás", age: 18, from: "Paraguay", flag: "🇵🇾", career: "Derecho", tags: ["Prefiero la calma", "Cine"], tone: "lilac" },
  { name: "Agustina", age: 22, from: "Colombia", flag: "🇨🇴", career: "Psicología", tags: ["Muy sociable", "Idiomas"], tone: "butter" },
  { name: "Bruno", age: 20, from: "Brasil", flag: "🇧🇷", career: "Diseño Gráfico", tags: ["Arte", "Música"], tone: "mint" },
  { name: "Camila", age: 19, from: "Chile", flag: "🇨🇱", career: "Economía", tags: ["Madrugo", "Hago deporte"], tone: "sky" },
  { name: "Diego", age: 23, from: "Bolivia", flag: "🇧🇴", career: "Medicina", tags: ["Me gusta cocinar", "Cine"], tone: "peach" },
  { name: "Sofía", age: 18, from: "Ecuador", flag: "🇪🇨", career: "Medicina", tags: ["Lectura", "Idiomas"], tone: "lilac" },
  { name: "Mateo", age: 21, from: "Argentina", flag: "🇦🇷", career: "Economía", tags: ["Muy sociable", "Hago deporte"], tone: "butter" },
];

/**
 * Con cuántos perfiles REALES (estudiantes 18+ que tildaron la comunidad) el carrusel apaga del todo los ficticios (DR67 h: 10).
 * Mientras tanto, cada perfil real retira UN ejemplo (el pozo de ejemplos tiene `EXAMPLE_PROFILES.length`), así la tira mantiene su
 * densidad sin mezclar más ficción de la necesaria.
 */
export const EXAMPLES_OFF_AT = 10;

export function examplesToShow(realCount: number): number {
  const real = Number.isFinite(realCount) ? Math.max(0, Math.floor(realCount)) : 0;
  if (real >= EXAMPLES_OFF_AT) return 0;
  return Math.max(0, EXAMPLE_PROFILES.length - real);
}

/** Fecha de cierre de la convocatoria de fundadoras (`FOUNDERS_CLOSE_AT`, ISO 8601). Sin fecha definida NO hay cuenta regresiva (DR46.2). */
export type FounderClosure = { kind: "none" } | { kind: "open"; closesAt: string } | { kind: "closed" };

export function founderClosure(raw: string | null | undefined, now: Date = new Date()): FounderClosure {
  const text = (raw ?? "").trim();
  if (!text) return { kind: "none" };
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return { kind: "none" };
  if (time <= now.getTime()) return { kind: "closed" };
  return { kind: "open", closesAt: new Date(time).toISOString() };
}

/** Qué le decimos a una residencia que acaba de dejar su solicitud (pantalla de éxito y mail). */
export type FounderPlace = "cupo" | "lleno" | "cerrado" | "unknown";

/**
 * Se calcula con el estado de ANTES de guardar la solicitud: si ya estaba todo el cupo en proceso, esta no ocupa uno; si no,
 * sí lo ocupa mientras avanza la visita (DR46.1). Convocatoria cerrada o cupo sin consultar: nada de promesas.
 */
export function founderPlace(before: FounderState, closure: FounderClosure): FounderPlace {
  if (closure.kind === "closed") return "cerrado";
  if (before.kind === "unknown") return "unknown";
  if (before.kind === "full") return "lleno";
  return "cupo";
}
