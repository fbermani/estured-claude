/**
 * Capítulos de la ficha de residencia (propuesta A, fase 3): la ficha como secuencia numerada de capítulos con navegación por chips.
 * Lógica pura: define el ORDEN oficial, qué capítulos se muestran (según los datos de la residencia) y su numeración, que se calcula
 * sobre los capítulos VISIBLES (nunca hay un salto «01, 02, 04»: el número refleja el orden real de lo que se ve).
 */
export type ChapterKey = "vivir" | "tarifas" | "incluye" | "preguntas" | "comunidad" | "reglas" | "ubicacion";

type ChapterDef = {
  key: ChapterKey;
  /** `id` del ancla. `tarifas` conserva el nombre histórico: lo usan los links de /search, la comunidad y las barras de la ficha (`#tarifas`). */
  id: string;
  /** Título del capítulo (h2). */
  title: string;
  /** Texto corto del chip de la navegación. */
  navLabel: string;
};

/** Orden oficial de los capítulos (SPEC de la propuesta A). */
export const CHAPTER_DEFS: readonly ChapterDef[] = [
  { key: "vivir", id: "vivir", title: "Vivir acá", navLabel: "Vivir acá" },
  { key: "tarifas", id: "tarifas", title: "Habitaciones y precio", navLabel: "Habitaciones y precio" },
  { key: "incluye", id: "incluye", title: "Qué incluye y qué se paga aparte", navLabel: "Qué incluye" },
  { key: "preguntas", id: "preguntas", title: "Preguntas que más nos hacen", navLabel: "Preguntas" },
  { key: "comunidad", id: "comunidad", title: "La comunidad", navLabel: "La comunidad" },
  { key: "reglas", id: "reglas", title: "Reglas de casa", navLabel: "Reglas de casa" },
  { key: "ubicacion", id: "ubicacion", title: "Dónde está", navLabel: "Dónde está" },
];

export type Chapter = ChapterDef & {
  /** «01», «02»…: posición entre los capítulos visibles. */
  number: string;
};

/** Qué capítulos tienen contenido para esta residencia. Los que no se pasan (o van en `false`) no se dibujan ni entran en la navegación. */
export type ChapterVisibility = Partial<Record<ChapterKey, boolean>>;

export function buildChapters(visible: ChapterVisibility): Chapter[] {
  return CHAPTER_DEFS.filter((c) => visible[c.key] === true).map((c, i) => ({ ...c, number: String(i + 1).padStart(2, "0") }));
}
