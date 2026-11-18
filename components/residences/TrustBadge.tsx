import type { VerificationStatus } from "@/types/domain";
import { Icon } from "@/components/ui/Icon";

/**
 * Sello "Residencia Verificada" (docs/00 §7, docs/01 §11).
 * La verificación es presencial y realizada por el equipo de EstuRed.
 */
export function TrustBadge({
  status,
  size = "sm",
  stamp = false,
}: {
  status: VerificationStatus;
  /** `icon`: solo el ícono en un chip redondo (miniatura de la vista lista en mobile); el texto queda para lectores de pantalla. */
  size?: "sm" | "md" | "icon";
  /** Sello que se estampa al aparecer: solo para el momento de la ficha, no para listas. */
  stamp?: boolean;
}) {
  if (status !== "verified_active") return null;
  if (size === "icon") {
    return (
      <span
        className="inline-flex size-6 items-center justify-center rounded-full bg-white/95 text-forest-700 shadow-sm ring-[1.5px] ring-forest-tint"
        title="Verificada presencialmente por el equipo de EstuRed"
      >
        <Icon name="verified" className="text-sm" />
        <span className="sr-only">Residencia Verificada</span>
      </span>
    );
  }
  const sizing =
    size === "md" ? "text-sm px-3 py-1" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`${stamp ? "stamp-in " : ""}inline-flex items-center gap-1 rounded-full bg-white/95 font-bold text-forest-700 shadow-sm ring-[1.5px] ring-forest-tint ${sizing}`}
      title="Verificada presencialmente por el equipo de EstuRed"
    >
      <Icon name="verified" className={size === "md" ? "text-base" : "text-sm"} />
      Residencia Verificada
    </span>
  );
}
