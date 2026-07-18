import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const STATUS_COPY: Record<string, { label: string; tone: "neutral" | "amber" | "sage" }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_verification: { label: "Pendiente de verificación", tone: "amber" },
  verification_scheduled: { label: "Visita programada", tone: "amber" },
  verified_active: { label: "Verificada y publicada", tone: "sage" },
  needs_changes: { label: "Requiere cambios", tone: "amber" },
};

const OPEN_SUPPORT_STATUSES = [
  "opened",
  "submitted",
  "under_review",
  "needs_more_info",
  "waiting_other_party",
  "in_progress",
];

type ResidenceRow = {
  id: string;
  name: string;
  public_area: string | null;
  status: string;
  tagline: string | null;
};

export type OwnerResidenceCardData = {
  residenceId: string;
  name: string;
  zone: string;
  statusLabel: string;
  statusTone: "neutral" | "amber" | "sage";
  occupancyFull: boolean;
  occupied: number;
  capacity: number;
  newApplications: number;
  renewalsPending: number;
  supportOpen: number;
  avgPriceUsd: number | null;
  photoUrl: string | null;
};

/**
 * Métricas por residencia para el dueño (`/residence/dashboard` y su
 * reporte PDF) — extraído a lib compartida (Ciclo 34septvicies) para
 * que la página y el export a PDF no dupliquen las mismas ~10 queries
 * por residencia. Cada residencia trae SOLO sus propias métricas —
 * nunca sumadas entre residencias (docs/00 §25.3).
 */
export async function getOwnerResidenceCards(
  admin: SupabaseClient,
  userId: string,
): Promise<OwnerResidenceCardData[]> {
  const residences = (
    await admin
      .from("residence_users")
      .select("role, residences(id, name, public_area, status, tagline)")
      .eq("user_id", userId)
      .eq("is_active", true)
  ).data ?? [];

  const cards = await Promise.all(
    residences.map(async (ru) => {
      const r = ru.residences as unknown as ResidenceRow | null;
      if (!r) return null;

      const { data: activeRooms } = await admin.from("rooms").select("id").eq("residence_id", r.id).eq("is_active", true);
      const roomIds = (activeRooms ?? []).map((room) => room.id);

      const [
        { count: capacityCount },
        { count: occupied },
        { count: newApplications },
        { count: pendingRenewalRequests },
        { count: pendingRenewalOffers },
        { count: supportOpen },
        { data: roomTypes },
        { data: photos },
      ] = await Promise.all([
        roomIds.length > 0
          ? admin.from("beds").select("*", { count: "exact", head: true }).in("room_id", roomIds).eq("status", "active")
          : Promise.resolve({ count: 0 }),
        admin.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("is_current", true).not("bed_id", "is", null),
        admin.from("application_requests").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("status", "submitted"),
        admin.from("renewal_requests").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("status", "notified_to_residence"),
        admin.from("renewal_offers").select("*", { count: "exact", head: true }).eq("residence_id", r.id).in("status", ["sent", "viewed"]),
        admin.from("support_cases").select("*", { count: "exact", head: true }).eq("residence_id", r.id).in("status", OPEN_SUPPORT_STATUSES),
        admin.from("room_types").select("monthly_price_usd").eq("residence_id", r.id).eq("is_active", true),
        admin
          .from("files")
          .select("storage_path")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", r.id)
          .eq("document_type", "residence_photo")
          .eq("status", "approved")
          .order("created_at", { ascending: true })
          .limit(1),
      ]);

      const prices = (roomTypes ?? []).map((rt) => Number(rt.monthly_price_usd)).filter((p) => !Number.isNaN(p));
      const avgPriceUsd = prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : null;
      const photoUrl = photos?.[0]
        ? admin.storage.from("public-residence-media").getPublicUrl(photos[0].storage_path).data.publicUrl
        : null;
      const capacity = capacityCount ?? 0;
      const occupancyFull = capacity > 0 && (occupied ?? 0) >= capacity;
      const badge = STATUS_COPY[r.status] ?? STATUS_COPY.draft;

      return {
        residenceId: r.id,
        name: r.name,
        zone: r.public_area ? `${r.public_area}, CABA` : "Zona sin definir",
        statusLabel: badge.label,
        statusTone: badge.tone,
        occupancyFull,
        occupied: occupied ?? 0,
        capacity,
        newApplications: newApplications ?? 0,
        renewalsPending: (pendingRenewalRequests ?? 0) + (pendingRenewalOffers ?? 0),
        supportOpen: supportOpen ?? 0,
        avgPriceUsd,
        photoUrl,
      };
    }),
  );

  return cards.filter((c): c is OwnerResidenceCardData => c !== null);
}
