const LINK =
  "inline-flex min-h-11 items-center rounded-field px-2 font-semibold underline underline-offset-4 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink";

/** Términos y Privacidad al pie de la primera pantalla de un popup de preapertura. Abren en otra pestaña: el popup queda como estaba. */
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legales" className={`flex flex-wrap justify-center gap-x-4 text-sm text-ink-soft ${className}`}>
      <a href="/consentimientos#terminos" target="_blank" rel="noopener" className={LINK}>
        Términos
      </a>
      <a href="/consentimientos#privacidad" target="_blank" rel="noopener" className={LINK}>
        Privacidad
      </a>
    </nav>
  );
}
