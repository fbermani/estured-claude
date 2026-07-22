import type { VerificationStatus } from "@/types/domain";
import { Icon } from "@/components/ui/Icon";

/**
 * Sello "Residencia Verificada" (docs/00 §7, docs/01 §11).
 * La verificación es presencial y realizada por el equipo de EstuRed.
 */
export function TrustBadge({
  status,
  size = "sm",
}: {
  status: VerificationStatus;
  size?: "sm" | "md";
}) {
  if (status !== "verified_active") return null;
  const sizing =
    size === "md" ? "text-sm px-3 py-1" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-white/95 font-bold text-forest-700 shadow-sm ring-[1.5px] ring-forest-tint ${sizing}`}
      title="Verificada presencialmente por el equipo de EstuRed"
    >
      <Icon name="verified" className={size === "md" ? "text-base" : "text-sm"} />
      Residencia Verificada
    </span>
  );
}
