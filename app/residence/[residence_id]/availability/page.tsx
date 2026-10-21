import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatUsd } from "@/lib/mock/exchange";
import { AvailabilityForm } from "@/app/residence/[residence_id]/availability/AvailabilityForm";

export const metadata: Metadata = { title: "Disponibilidad" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "danger" }> = {
  available_to_confirm: { label: "Disponible", tone: "sage" },
  full: { label: "Completa", tone: "neutral" },
  not_updated: { label: "Sin actualizar", tone: "amber" },
  paused_by_residence: { label: "Pausada por vos", tone: "neutral" },
  paused_by_admin: { label: "Pausada por EstuRed", tone: "danger" },
};

export default async function ResidenceAvailabilityPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const { data: roomTypes, error } = await admin
    .from("room_types")
    .select(
      "id, name, monthly_price_usd, profile_availability (status, available_count, available_from, notes_public, last_confirmed_at, hidden_from_search_at)",
    )
    .eq("residence_id", residenceId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) console.error("[residence/availability] query failed:", error);

  // profile_availability tiene `unique(room_type_id)` — PostgREST detecta
  // la relación 1:1 y devuelve un objeto singular en el embed, no un
  // array (a diferencia de la mayoría de los embeds de este proyecto).
  const rows =
    (roomTypes as unknown as {
      id: string;
      name: string;
      monthly_price_usd: number;
      profile_availability: {
        status: string;
        available_count: number | null;
        available_from: string | null;
        notes_public: string | null;
        last_confirmed_at: string;
        hidden_from_search_at: string | null;
      } | null;
    }[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Disponibilidad</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Actualizá la disponibilidad al menos cada 30 días — si no, se muestra como &ldquo;sin actualizar&rdquo; y
        después de 15 días más deja de aparecer en las búsquedas.
      </p>

      <div className="mt-6 space-y-4">
        {rows.map((rt) => {
          const availability = rt.profile_availability;
          const badge = availability
            ? STATUS_COPY[availability.status] ?? { label: availability.status, tone: "neutral" as const }
            : { label: "Sin disponibilidad cargada", tone: "neutral" as const };
          return (
            <Card key={rt.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{rt.name}</p>
                  <p className="text-xs text-ink-faint">{formatUsd(Number(rt.monthly_price_usd))}/mes</p>
                  {availability && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Última actualización {formatDate(availability.last_confirmed_at)}
                      {availability.hidden_from_search_at && " · oculta de las búsquedas"}
                    </p>
                  )}
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              {availability ? (
                <AvailabilityForm
                  residenceId={residenceId}
                  roomTypeId={rt.id}
                  currentStatus={availability.status === "not_updated" ? "available_to_confirm" : availability.status}
                  currentAvailableCount={availability.available_count}
                  currentAvailableFrom={availability.available_from}
                  currentNotesPublic={availability.notes_public}
                />
              ) : (
                <p className="mt-3 text-sm text-ink-faint">
                  Este tipo de habitación todavía no tiene disponibilidad cargada.
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
