/**
 * Alturas de las barras fijas de la ficha, en una sola fuente: la navbar del sitio y la navegación de capítulos (chips). Las usan el
 * `top` de la navegación de capítulos, el `scroll-mt` de las anclas y el `top` / `max-h` del panel de solicitud sticky, así ninguno
 * queda tapado por las barras. Se publican como variables CSS en el contenedor de la ficha (`FICHA_BARS_STYLE`); cada consumidor
 * trae un respaldo (`var(--x, valor)`) por si la variable no llega.
 */
import type { CSSProperties } from "react";

export const FICHA_NAVBAR_REM = 4.0625; // navbar h-16 (64 px) + filete inferior de 1 px
/** Navegación de capítulos: chip de 44 px + 8 px de aire arriba y abajo + el filete inferior de 1,5 px (≈ 61,5 px → 3,9 rem). */
export const FICHA_CHIPS_REM = 3.9;

export const FICHA_BARS_STYLE = {
  "--ficha-navbar-h": `${FICHA_NAVBAR_REM}rem`,
  "--ficha-chips-h": `${FICHA_CHIPS_REM}rem`,
} as CSSProperties;
