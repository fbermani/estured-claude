import { Icon } from "@/components/ui/Icon";

/** «Sumarte es gratis»: «Gratis» se usa solo para sumarse (DR46.3 / DR47.2), nunca como promesa sobre una reserva. */
export function FreeBadge({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex items-center gap-2 rounded-field border-[1.5px] border-forest/25 bg-forest-tint px-3 py-2.5 text-sm font-bold text-forest-700 ${className}`}
    >
      <Icon name="sell" className="text-xl" />
      <span>
        Sumarte es gratis<span className="font-semibold opacity-90">, sin tarjeta, sin compromiso</span>
      </span>
    </p>
  );
}
