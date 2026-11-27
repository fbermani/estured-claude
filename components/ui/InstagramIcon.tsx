/** Logo de Instagram. Material Symbols no trae logos de marcas: va dibujado. Decorativo: el texto al lado lo nombra. */
export function InstagramIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
