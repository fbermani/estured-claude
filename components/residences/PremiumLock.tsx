import { Icon } from "@/components/ui/Icon";

/**
 * Remarcado visual del Plan Premium (DR17). Solo presentación: las funciones siguen andando (D8).
 * Sin "use client": se usa tanto desde Server Components como desde el sidebar.
 */

/** Candado neutro (el naranja queda para lo urgente): `compact`/por defecto solo ícono; el texto va para lectores de pantalla. */
export function PremiumTag({ className = "" }: { className?: string; compact?: boolean }) {
  return (
    <span title="Plan Premium" className={`inline-flex shrink-0 items-center text-ink-faint ${className}`}>
      <Icon name="lock" className="text-base" aria-hidden />
      <span className="sr-only">Premium</span>
    </span>
  );
}
