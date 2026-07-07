/**
 * Tokens de "Operational Command" — sistema visual del panel admin.
 *
 * Deliberadamente distinto del sistema público (petróleo/salvia/arena):
 * el back-office prioriza densidad y precisión sobre calidez de marca.
 * Fuente: design-references/stitch_estured_mvp_3ra parte/operational_command/DESIGN.md
 *
 * Se usan como Tailwind arbitrary values (bg-[var(--cmd-primary)] etc.)
 * en vez de extender @theme global, para no mezclar este sub-sistema
 * con los tokens de marca del sitio público (app/globals.css).
 */
export const cmd = {
  primary: "#003d9b",
  primaryContainer: "#0052cc",
  onPrimaryContainer: "#c4d2ff",
  surface: "#f7f9fb",
  surfaceContainerLow: "#f2f4f6",
  surfaceContainer: "#eceef0",
  border: "#e2e8f0",
  onSurface: "#191c1e",
  onSurfaceVariant: "#434654",
  outline: "#737685",
  amber: "#b45309",
  amberBg: "#fef3c7",
  emerald: "#047857",
  emeraldBg: "#d1fae5",
  rose: "#be123c",
  roseBg: "#ffe4e6",
  violet: "#6d28d9",
  violetBg: "#ede9fe",
} as const;
