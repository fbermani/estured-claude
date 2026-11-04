/**
 * Tilde de confirmación que se dibuja: aro 420ms y tilde 360ms (stroke-dashoffset, ver `.dc-*` en
 * app/globals.css). Solo trazo y opacidad. Con prefers-reduced-motion queda dibujado de entrada.
 * Decorativo: el texto de la confirmación va al lado, en un `role="status"`.
 */
export function DrawCheck({ className = "size-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className={`flex-none ${className}`}>
      <circle className="dc-ring fill-forest-tint stroke-forest" cx="28" cy="28" r="26" strokeWidth="3" />
      <path className="dc-tick fill-none stroke-forest-700" d="M17 29.5l8 8 15-17" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
