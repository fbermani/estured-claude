import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Panel de residencia" };
export const dynamic = "force-dynamic";

const statusCopy: Record<string, { label: string; tone: "neutral" | "amber" | "sage" }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_verification: { label: "Pendiente de verificación", tone: "amber" },
  verification_scheduled: { label: "Visita programada", tone: "amber" },
  verified_active: { label: "Verificada y publicada", tone: "sage" },
  needs_changes: { label: "Requiere cambios", tone: "amber" },
};

/**
 * Vista multi-residencia en scroll vertical, sin agregado (docs/11 §7.3,
 * docs/00: "no dashboard agregado multi-residencia" fuera del MVP).
 * Con una sola residencia hoy, pero la estructura ya soporta N.
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

  const pendingCounts: Record<string, number> = {};
  if (admin) {
    for (const ru of residences) {
      const r = ru.residences as unknown as { id: string } | null;
      if (!r) continue;
      const { count } = await admin
        .from("application_requests")
        .select("*", { count: "exact", head: true })
        .eq("residence_id", r.id)
        .eq("status", "submitted");
      pendingCounts[r.id] = count ?? 0;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-petrol-800">Tus residencias</h1>
          <p className="mt-1 text-ink-soft">Gestioná el perfil y la publicación de cada una.</p>
        </div>
        <Button href="/register/residence" variant="outline" size="sm">
          + Sumar otra residencia
        </Button>
      </div>

      {residences.length === 0 ? (
        <EmptyState
          title="Todavía no tenés residencias cargadas"
          description="Si acabás de registrarte, puede que falte completar el alta."
        />
      ) : (
        <div className="space-y-4">
          {residences.map((ru) => {
            const r = ru.residences as unknown as {
              id: string;
              name: string;
              public_area: string | null;
              status: string;
              tagline: string | null;
            };
            const badge = statusCopy[r.status] ?? statusCopy.draft;
            return (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-petrol-800">{r.name}</h2>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {r.public_area ? `${r.public_area}, CABA` : "Zona sin definir"}
                    {r.tagline && ` — ${r.tagline}`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {pendingCounts[r.id] > 0 && (
                    <Link
                      href={`/residence/${r.id}/applications`}
                      className="flex items-center gap-1.5 text-sm font-semibold text-petrol-600 hover:text-petrol-700"
                    >
                      <Badge tone="amber">{pendingCounts[r.id]} nueva(s)</Badge>
                      Solicitudes →
                    </Link>
                  )}
                  <Link
                    href={`/residence/${r.id}/profile`}
                    className="text-sm font-semibold text-petrol-600 hover:text-petrol-700"
                  >
                    {r.status === "draft" ? "Completar perfil →" : "Editar perfil →"}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
