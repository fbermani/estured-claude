import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivateResidentStayButton, ToggleResidentVisibilityButton } from "@/app/students/residency/ResidencyActions";

export const metadata: Metadata = { title: "Mi estadía" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" }> = {
  active: { label: "Visible en la comunidad", tone: "sage" },
  visibility_limited: { label: "Visible — visibilidad limitada", tone: "sage" },
  hidden_by_user: { label: "Oculto de la comunidad", tone: "neutral" },
};

type StayRow = {
  id: string;
  status: string;
  invite_email: string | null;
  residences: { name: string; slug: string } | null;
  room_types: { name: string } | null;
};

export default async function StudentResidencyPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();

  let pending: StayRow[] = [];
  let mine: StayRow[] = [];

  if (sessionUser && admin) {
    // Docs/05 §15.1: la invitación pendiente todavía no tiene
    // student_profile_id, así que la política RLS "es mío" no la cubre
    // todavía — se busca por email con el cliente admin (server-side,
    // filtrado explícito por el propio email de la sesión).
    const { data: user } = await admin.from("users").select("email").eq("id", sessionUser.id).maybeSingle();
    if (user?.email) {
      const { data } = await admin
        .from("resident_stays")
        .select("id, status, invite_email, residences(name, slug), room_types(name)")
        .eq("invite_email", user.email.toLowerCase())
        .is("student_profile_id", null)
        .eq("is_current", true);
      pending = (data as unknown as StayRow[]) ?? [];
    }
  }

  if (supabase) {
    const { data, error } = await supabase
      .from("resident_stays")
      .select("id, status, invite_email, residences(name, slug), room_types(name)")
      .eq("is_current", true)
      .in("status", ["active", "visibility_limited", "hidden_by_user"]);
    if (error) console.error("[students/residency] query failed:", error);
    mine = (data as unknown as StayRow[]) ?? [];
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-petrol-800">Mi estadía</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Si tu residencia te cargó como residente, activá tu cuenta para aparecer en la comunidad visible — vos
        decidís si aparecer o no.
      </p>

      {pending.length > 0 && (
        <div className="mt-6 space-y-4">
          {pending.map((stay) => (
            <Card key={stay.id} className="border-petrol-200 bg-petrol-50 p-5">
              <p className="font-semibold text-petrol-800">
                {stay.residences?.name} te cargó como residente
              </p>
              <p className="mt-1 text-xs text-ink-faint">{stay.room_types?.name ?? "Sin tipo asignado"}</p>
              <ActivateResidentStayButton residentStayId={stay.id} />
            </Card>
          ))}
        </div>
      )}

      {mine.length === 0 && pending.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Sin estadías cargadas"
            description="Cuando la residencia donde vivís te cargue como residente, vas a poder activar tu cuenta acá."
          />
        </div>
      ) : (
        mine.length > 0 && (
          <div className="mt-6 space-y-4">
            {mine.map((stay) => {
              const badge = STATUS_COPY[stay.status] ?? { label: stay.status, tone: "neutral" as const };
              return (
                <Card key={stay.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/residencias/${stay.residences?.slug}`} className="font-semibold text-ink hover:underline">
                        {stay.residences?.name}
                      </Link>
                      <p className="text-xs text-ink-faint">{stay.room_types?.name ?? "Sin tipo asignado"}</p>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <ToggleResidentVisibilityButton residentStayId={stay.id} hidden={stay.status === "hidden_by_user"} />
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
