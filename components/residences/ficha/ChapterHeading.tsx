import type { ReactNode } from "react";

/**
 * Encabezado de un capítulo de la ficha (propuesta A, fase 3): el número del capítulo («01») y el título (h2). El número encodea el
 * orden real de los capítulos visibles (lo calcula `buildChapters`) y es decorativo para lectores de pantalla. El h2 lleva `id`
 * (`h-<capítulo>`) para el `aria-labelledby` de su `<section>`.
 * `tone="dark"`: para la banda forest-ink de las preguntas (título en paper y número en naranja claro, el único uso permitido del
 * naranja original sobre fondos oscuros).
 */
export function ChapterHeading({
  id,
  number,
  tone = "light",
  children,
}: {
  id: string;
  number: string;
  tone?: "light" | "dark";
  children: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <span aria-hidden="true" className={`font-display text-base font-semibold tabular-nums ${dark ? "text-orange-light" : "text-orange-700"}`}>
        {number}
      </span>
      <h2
        id={id}
        className={`font-display text-3xl font-bold leading-[1.05] min-[768px]:text-4xl min-[1100px]:text-5xl ${dark ? "text-paper" : "text-ink"}`}
      >
        {children}
      </h2>
    </div>
  );
}
