#!/usr/bin/env node
/**
 * Chequeo de contraste WCAG 2.x (luminancia relativa) de los tokens de marca.
 * Lee los colores de `app/globals.css` (@theme) y de `components/admin/ui/tokens.ts` (panel admin FRESH)
 * y falla (exit 1) si algún par crítico queda bajo el umbral.
 *
 *   node scripts/check-contrast.mjs
 *
 * Umbrales: 4.5 para texto normal (WCAG 1.4.3 AA), 3 para componentes de UI (WCAG 1.4.11: bordes de
 * inputs, foco). Agregá pares nuevos a PAIRS cuando sumes un token de texto o de borde.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const adminTs = readFileSync(join(root, "components/admin/ui/tokens.ts"), "utf8");

// --- Tokens de @theme (resuelve var(--color-x) de un nivel o más) ---
const raw = {};
for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|var\(--color-[a-z0-9-]+\))/g)) {
  raw[m[1]] = m[2];
}
function theme(name) {
  let v = raw[name];
  if (!v) throw new Error(`Token --color-${name} no encontrado en globals.css`);
  const seen = new Set();
  while (v.startsWith("var(")) {
    const next = v.match(/var\(--color-([a-z0-9-]+)\)/)[1];
    if (seen.has(next)) throw new Error(`Ciclo en --color-${name}`);
    seen.add(next);
    v = raw[next];
  }
  return v.toLowerCase();
}

// --- Tokens admin (objeto `cmd`) ---
const cmd = {};
for (const m of adminTs.matchAll(/^\s*(\w+):\s*"(#[0-9a-fA-F]{6})"/gm)) cmd[m[1]] = m[2].toLowerCase();
const adm = (k) => {
  if (!cmd[k]) throw new Error(`cmd.${k} no encontrado en tokens.ts`);
  return cmd[k];
};

// --- WCAG ---
const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
export const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const T = 4.5; // texto
const U = 3; // componente de UI
const W = "#ffffff";

/** [etiqueta, fg, bg, umbral] */
const PAIRS = [
  // Texto sobre fondos base
  ["texto principal / crema", theme("ink"), theme("cream"), T],
  ["texto principal / blanco", theme("ink"), theme("paper"), T],
  ["texto secundario / crema", theme("ink-soft"), theme("cream"), T],
  ["texto secundario / crema-2", theme("ink-soft"), theme("cream-2"), T],
  ["muted / crema", theme("muted"), theme("cream"), T],
  ["muted / crema-2 (peor caso)", theme("muted"), theme("cream-2"), T],
  ["muted / blanco", theme("muted"), theme("paper"), T],
  ["muted / forest-tint", theme("muted"), theme("forest-tint"), T],
  ["ink-faint / crema", theme("ink-faint"), theme("cream"), T],
  ["ink-faint / crema-2", theme("ink-faint"), theme("cream-2"), T],
  // Botones (texto blanco)
  ["blanco / botón forest", W, theme("forest"), T],
  ["blanco / botón forest hover", W, theme("forest-600"), T],
  ["blanco / botón naranja", W, theme("orange"), T],
  ["blanco / botón naranja hover", W, theme("orange-600"), T],
  ["blanco / forest-ink (footer)", W, theme("forest-ink"), T],
  ["eyebrow naranja claro / forest-ink", theme("orange-light"), theme("forest-ink"), T],
  ["naranja (borde, punto) / crema", theme("orange"), theme("cream"), U],
  // Badges / avisos (texto del mismo hue sobre su tint)
  ["badge naranja (orange-700 / orange-tint)", theme("orange-700"), theme("orange-tint"), T],
  ["orange-700 / crema", theme("orange-700"), theme("cream"), T],
  ["orange-700 / blanco", theme("orange-700"), theme("paper"), T],
  ["badge forest (forest-700 / forest-tint)", theme("forest-700"), theme("forest-tint"), T],
  ["badge mint (forest-700 / mint)", theme("forest-700"), theme("mint"), T],
  ["badge rojo (red-700 / red-tint)", theme("red-700"), theme("red-tint"), T],
  ["badge info (blue-ink / blue-tint)", theme("blue-ink"), theme("blue-tint"), T],
  ["badge butter (butter-fg / butter)", theme("butter-fg"), theme("butter"), T],
  ["badge lilac (lilac-fg / lilac)", theme("lilac-fg"), theme("lilac"), T],
  ["badge sky (sky-fg / sky)", theme("sky-fg"), theme("sky"), T],
  ["badge neutral (ink-soft / crema-2)", theme("ink-soft"), theme("cream-2"), T],
  ["link forest-700 / crema", theme("forest-700"), theme("cream"), T],
  // Componentes de UI (1.4.11)
  ["borde de input / crema", theme("field-border"), theme("cream"), U],
  ["borde de input / blanco", theme("field-border"), theme("paper"), U],
  ["borde de input / crema-2", theme("field-border"), theme("cream-2"), U],
  ["anillo de foco forest / crema", theme("forest"), theme("cream"), U],
  // Panel admin FRESH (tokens.ts)
  ["admin: texto / superficie", adm("onSurface"), adm("surface"), T],
  ["admin: texto variante / superficie", adm("onSurfaceVariant"), adm("surface"), T],
  ["admin: outline (muted) / superficie", adm("outline"), adm("surface"), T],
  ["admin: outline (muted) / superficie-low", adm("outline"), adm("surfaceContainerLow"), T],
  ["admin: ámbar / ámbar-bg", adm("amber"), adm("amberBg"), T],
  ["admin: nav activo / tint", adm("navActiveFg"), adm("onPrimaryContainer"), T],
  ["admin: esmeralda / bg", adm("emerald"), adm("emeraldBg"), T],
  ["admin: rosa / bg", adm("rose"), adm("roseBg"), T],
  ["admin: violeta / bg", adm("violet"), adm("violetBg"), T],
  ["admin: blanco / botón primario", W, adm("primary"), T],
  ["admin: blanco / botón primario hover", W, adm("primaryContainer"), T],
  ["admin: borde de control (outline) / superficie", adm("outline"), adm("surface"), U],
];

// Los valores de tokens.ts deben seguir 1:1 a @theme (lo dice el propio archivo).
const SYNC = [
  ["primary", "forest"],
  ["primaryContainer", "forest-600"],
  ["onPrimaryContainer", "orange-tint"],
  ["navActiveFg", "orange-700"],
  ["surface", "cream"],
  ["surfaceContainerLow", "cream-2"],
  ["border", "line"],
  ["onSurface", "ink"],
  ["onSurfaceVariant", "ink-soft"],
  ["outline", "muted"],
  ["amber", "orange-700"],
  ["amberBg", "orange-tint"],
  ["emerald", "forest-700"],
  ["emeraldBg", "forest-tint"],
  ["rose", "red-700"],
  ["roseBg", "red-tint"],
  ["violet", "lilac-fg"],
  ["violetBg", "lilac"],
];

let failed = 0;
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad("Par", 48)} ${pad("fg", 8)} ${pad("bg", 8)} ${pad("ratio", 7)} min   estado`);
for (const [label, fg, bg, min] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(
    `${pad(label, 48)} ${pad(fg, 8)} ${pad(bg, 8)} ${pad(r.toFixed(2), 7)} ${pad(min, 5)} ${ok ? "OK" : "FALLA"}`,
  );
}
for (const [k, t] of SYNC) {
  if (adm(k) !== theme(t)) {
    failed++;
    console.log(`DESINCRONIZADO: cmd.${k} (${adm(k)}) != --color-${t} (${theme(t)})`);
  }
}
console.log(failed ? `\n${failed} chequeo(s) fallaron.` : "\nTodos los pares críticos cumplen.");
process.exit(failed ? 1 : 0);
