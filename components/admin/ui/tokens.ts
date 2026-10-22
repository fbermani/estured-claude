/**
 * Tokens del panel admin ("Operational Command"), unificados con el
 * sistema visual FRESH del sitio público (design-references/fresh-style.md,
 * ver app/globals.css). Misma paleta forest/orange/cream que el resto del
 * proyecto — el back-office mantiene su densidad estructural propia
 * (tablas compactas, radios chicos) pero ya no usa una marca de color aparte.
 *
 * Se mantienen como objeto JS (no Tailwind classes) porque las páginas admin
 * ya están escritas con `style={{ ... }}` referenciando estas propiedades;
 * los valores están tomados 1:1 de las custom properties de @theme.
 */
export const cmd = {
  primary: "#1f7d5c", // --color-forest
  primaryContainer: "#166349", // --color-forest-600
  // Ítem activo de nav = --orange-tint/--orange-700 (fresh-style.md §"Panel admin"),
  // no forest — es la única excepción documentada a "forest = acción principal".
  onPrimaryContainer: "#fde7da", // --color-orange-tint
  navActiveFg: "#9a4118", // --color-orange-700
  surface: "#fbf6ec", // --color-cream
  surfaceContainerLow: "#f4ecdc", // --color-cream-2
  surfaceContainer: "#f4ecdc", // --color-cream-2
  border: "#e8e0d2", // --color-line
  onSurface: "#1d2722", // --color-ink
  onSurfaceVariant: "#44524b", // --color-ink-soft
  outline: "#5f6c65", // --color-muted / --color-ink-faint
  amber: "#9a4118", // --color-orange-700
  amberBg: "#fde7da", // --color-orange-tint
  emerald: "#0f4d39", // --color-forest-700
  emeraldBg: "#e2f1ea", // --color-forest-tint
  rose: "#9c392e", // --color-red-700
  roseBg: "#fbe5e2", // --color-red-tint
  violet: "#5b4ea8", // --color-lilac-fg
  violetBg: "#e7e2f8", // --color-lilac
} as const;
