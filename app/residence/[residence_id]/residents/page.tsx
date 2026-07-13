import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddResidentForm } from "@/app/residence/[residence_id]/residents/AddResidentForm";
import { ResidentRowActions } from "@/app/residence/[residence_id]/residents/ResidentRowActions";

export const metadata: Metadata = { title: "Residentes" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  created_by_residence: { label: "Cargado, sin invitar", tone: "neutral" },
  pending_activation: { label: "Pendiente de activar cuenta", tone: "amber" },
  active: { label: "Activo", tone: "sage" },
  visibility_limited: { label: "Activo — visibilidad limitada", tone: "sage" },
  hidden_by_user: { label: "Activo — oculto de la comunidad", tone: "neutral" },
};

export default async function ResidenceResidentsPage({
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

  const [{ data: stays, error }, { data: roomTypes }] = await Promise.all([
    admin
      .from("resident_stays")
      .select("id, status, invite_email, start_date, end_date, room_types(name), student_profiles(first_name, last_initial)")
      .eq("residence_id", residenceId)
      .eq("is_current", true)
      .order("created_at", { ascending: false }),
    admin.from("room_types").select("id, name").eq("residence_id", residenceId).eq("is_active", true),
  ]);
  if (error) console.error("[residence/residents] query failed:", error);

  const rows =
    (stays as unknown as {
      id: string;
      status: string;
      invite_email: string | null;
      start_date: string | null;
      end_date: string | null;
      room_types: { name: string } | null;
      student_profiles: { first_name: string; last_initial: string } | null;
    }[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">Residentes</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Cargá quiénes viven hoy en tu residencia — alimenta la comunidad visible de tu ficha pública.
      </p>

      <div className="mt-6">
        <AddResidentForm residenceId={residenceId} roomTypes={roomTypes ?? []} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Sin residentes cargados" description="Cargá el primero con el formulario de arriba." />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((stay) => {
            const badge = STATUS_COPY[stay.status] ?? { label: stay.status, tone: "neutral" as const };
            const name = stay.student_profiles
              ? `${stay.student_profiles.first_name} ${stay.student_profiles.last_initial}.`
              : stay.invite_email;
            return (
              <Card key={stay.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{name}</p>
                    <p className="text-xs text-ink-faint">
                      {stay.room_types?.name ?? "Sin tipo asignado"}
                      {stay.start_date && <> · Desde {stay.start_date}</>}
                    </p>
                  </div>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                <ResidentRowActions residenceId={residenceId} residentStayId={stay.id} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
