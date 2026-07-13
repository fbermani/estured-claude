import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { PauseResidenceControl } from "@/app/admin/residences/PauseResidenceControl";

export const metadata: Metadata = { title: "Residencias" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
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

type ResidenceRow = {
  id: string;
  name: string;
  public_area: string | null;
  status: string;
  created_at: string;
};

export default async function AdminResidencesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const admin = getSupabaseAdmin();

  let query = admin
    ? admin.from("residences").select("id, name, public_area, status, created_at").order("created_at", { ascending: false }).limit(200)
    : null;
  if (query && q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data, error } = query ? await query : { data: [], error: null };
  if (error) console.error("[admin/residences] query failed:", error);
  const residences = (data as unknown as ResidenceRow[]) ?? [];
  const activeCount = residences.filter((r) => r.status === "verified_active").length;
  const pausedCount = residences.filter((r) => r.status === "paused_by_admin").length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Residencias
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} activa(s) de {residences.length} en total{pausedCount > 0 && ` · ${pausedCount} pausada(s) por admin`}.
        Desde acá se puede pausar o reactivar una residencia — validaciones pendientes van en{" "}
        <code>/admin/verifications</code>.
      </p>

      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre…"
          className="w-72 rounded-full px-4 py-2 text-sm"
          style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
        />
      </form>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Nombre", "Zona", "Alta", "Estado", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {residences.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? { label: r.status, tone: "neutral" as const };
              const canToggle = r.status === "verified_active" || r.status === "paused_by_admin";
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.public_area ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    {canToggle && <PauseResidenceControl residenceId={r.id} isPaused={r.status === "paused_by_admin"} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {residences.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            {q ? "Ninguna residencia coincide con esa búsqueda." : "Todavía no hay residencias registradas."}
          </p>
        )}
      </AdminCard>
    </div>
  );
}
