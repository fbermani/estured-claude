import type { VerificationStatus } from "@/types/domain";

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
      className={`inline-flex items-center gap-1 rounded-full bg-white/95 font-semibold text-sage-800 shadow-sm ring-1 ring-sage-200 ${sizing}`}
      title="Verificada presencialmente por el equipo de EstuRed"
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"}
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M10 1.5l2.09 1.51 2.57-.27 1.02 2.38 2.38 1.02-.27 2.57L19.3 10l-1.51 2.09.27 2.57-2.38 1.02-1.02 2.38-2.57-.27L10 19.3l-2.09-1.51-2.57.27-1.02-2.38-2.38-1.02.27-2.57L.7 10l1.51-2.09-.27-2.57 2.38-1.02 1.02-2.38 2.57.27L10 1.5zm3.7 6.21a.75.75 0 00-1.15-.96l-3.42 4.1-1.7-1.7a.75.75 0 10-1.06 1.06l2.28 2.28a.75.75 0 001.1-.05l3.95-4.73z"
          clipRule="evenodd"
        />
      </svg>
      Residencia Verificada
    </span>
  );
}
