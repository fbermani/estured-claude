import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AreaHeader } from "@/components/layout/AreaHeader";
import { Footer } from "@/components/layout/Footer";
import { OwnerResidenceCard } from "@/components/residences/OwnerResidenceCard";

export const metadata: Metadata = { title: "Panel de residencia" };
export const dynamic = "force-dynamic";

const statusCopy: Record<string, { label: string; tone: "neutral" | "amber" | "sage" }> = {
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

/**
 * Vista multi-residencia en scroll vertical, sin agregado (docs/00
 * §25.3, docs/11 §7.3: "No habrá un dashboard agregado con métricas
 * consolidadas de todas las residencias"). Cada card muestra métricas
 * reales de ESA residencia únicamente — nunca sumadas entre
 * residencias. Con una sola residencia hoy en la mayoría de las
 * cuentas demo, pero la estructura ya soporta hasta 10 (docs/00 §25.1).
 */
export default async function ResidenceDashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/residence/dashboard");

  const admin = getSupabaseAdmin();
  const residences = admin
    ? (
        await admin
          .from("residence_users")
          .select("role, residences(id, name, public_area, status, tagline)")
          .eq("user_id", sessionUser.id)
          .eq("is_active", true)
      ).data ?? []
    : [];

  const rate = admin ? await getCurrentExchangeRate() : null;
  const arsPerUsd = rate?.arsPerUsd ?? 0;

  const cards = admin
    ? await Promise.all(
        residences.map(async (ru) => {
          const r = ru.residences as unknown as ResidenceRow | null;
          if (!r) return null;

          const { data: activeRooms } = await admin!.from("rooms").select("id").eq("residence_id", r.id).eq("is_active", true);
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
              ? admin!.from("beds").select("*", { count: "exact", head: true }).in("room_id", roomIds).eq("status", "active")
              : Promise.resolve({ count: 0 }),
            admin!.from("resident_stays").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("is_current", true).not("bed_id", "is", null),
            admin!.from("application_requests").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("status", "submitted"),
            admin!.from("renewal_requests").select("*", { count: "exact", head: true }).eq("residence_id", r.id).eq("status", "notified_to_residence"),
            admin!.from("renewal_offers").select("*", { count: "exact", head: true }).eq("residence_id", r.id).in("status", ["sent", "viewed"]),
            admin!.from("support_cases").select("*", { count: "exact", head: true }).eq("residence_id", r.id).in("status", OPEN_SUPPORT_STATUSES),
            admin!.from("room_types").select("monthly_price_usd").eq("residence_id", r.id).eq("is_active", true),
            admin!
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
            ? admin!.storage.from("public-residence-media").getPublicUrl(photos[0].storage_path).data.publicUrl
            : null;
          const capacity = capacityCount ?? 0;
          const occupancyFull = capacity > 0 && (occupied ?? 0) >= capacity;
          const badge = statusCopy[r.status] ?? statusCopy.draft;

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
      )
    : [];

  const validCards = cards.filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className="flex min-h-screen flex-col">
      <AreaHeader areaLabel="Residencias" userEmail={sessionUser.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink">Tus residencias</h1>
            <p className="mt-1 text-ink-soft">Gestioná el perfil y la publicación de cada una.</p>
          </div>
          <Button href="/register/residence" variant="outline" size="sm">
            + Sumar otra residencia
          </Button>
        </div>

        {validCards.length === 0 ? (
          <EmptyState
            title="Todavía no tenés residencias cargadas"
            description="Si acabás de registrarte, puede que falte completar el alta."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {validCards.map((card) => (
              <OwnerResidenceCard key={card.residenceId} {...card} arsPerUsd={arsPerUsd} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
