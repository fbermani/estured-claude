/**
 * Enlace "Saltar al contenido" (WCAG 2.4.1). Invisible hasta que recibe foco de teclado;
 * apunta al `<main id="contenido">` de cada layout.
 */
export function SkipLink({ href = "#contenido" }: { href?: string }) {
  return (
    <a
      href={href}
      className="fixed left-4 top-4 z-[90] -translate-y-[200%] rounded-field border-2 border-forest-ink bg-forest-ink px-4 py-3 text-sm font-bold whitespace-nowrap text-paper shadow-float focus:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-paper"
    >
      Saltar al contenido
    </a>
  );
}
