export const RESIDENCE_STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_verification: { label: "Pendiente de verificación", tone: "amber" },
  verification_scheduled: { label: "Visita programada", tone: "amber" },
  verified_active: { label: "Activa y publicada", tone: "emerald" },
  needs_changes: { label: "Requiere cambios", tone: "amber" },
  paused_by_residence: { label: "Pausada (residencia)", tone: "neutral" },
  paused_by_admin: { label: "Pausada (admin)", tone: "rose" },
  suspended: { label: "Suspendida", tone: "rose" },
  verification_expired: { label: "Verificación vencida", tone: "rose" },
  archived: { label: "Archivada", tone: "neutral" },
};
