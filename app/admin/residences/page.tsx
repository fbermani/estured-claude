import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { PauseResidenceControl } from "@/app/admin/residences/PauseResidenceControl";
import { OperationalAccessControl } from "@/app/admin/residences/OperationalAccessControl";
import { RESIDENCE_STATUS_BADGE } from "@/app/admin/residences/statusBadge";
import { getStaleAvailabilityByResidence } from "@/lib/residences/staleAvailability";

export const metadata: Metadata = { title: "Residencias" };
export const dynamic = "force-dynamic";

type ResidenceRow = {
  id: string;
  name: string;
  public_area: string | null;
  status: string;
  created_at: string;
  has_operational_management_access: boolean;
  pioneer_free_access_until: string | null;
};

export default async function AdminResidencesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;
  const admin = getSupabaseAdmin();

  let query = admin
    ? admin
        .from("residences")
        .select("id, name, public_area, status, created_at, has_operational_management_access, pioneer_free_access_until")
        .order("created_at", { ascending: false })
        .limit(200)
    : null;
  if (query && q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data, error } = query ? await query : { data: [], error: null };
  if (error) console.error("[admin/residences] query failed:", error);
  const allResidences = (data as unknown as ResidenceRow[]) ?? [];
  // H23: residencias con disponibilidad vencida (tipos ocultos o sin actualizar).
  const staleByResidence = admin ? await getStaleAvailabilityByResidence(admin) : new Map();
  const onlyStale = filter === "stale-availability";
  const residences = onlyStale ? allResidences.filter((r) => staleByResidence.has(r.id)) : allResidences;
  const activeCount = allResidences.filter((r) => r.status === "verified_active").length;
  const pausedCount = allResidences.filter((r) => r.status === "paused_by_admin").length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Residencias
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {activeCount} activa(s) de {allResidences.length} en total{pausedCount > 0 && ` · ${pausedCount} pausada(s) por admin`}.
        Desde acá se puede pausar o reactivar una residencia — las validaciones pendientes están en{" "}
        <Link href="/admin/verifications" className="font-bold underline" style={{ color: cmd.primary }}>
          Verificaciones
        </Link>
        .
      </p>

      {onlyStale && (
        <p className="mt-3 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Mostrando solo residencias con disponibilidad vencida.{" "}
          <Link href="/admin/residences" className="font-bold underline" style={{ color: cmd.primary }}>
            Ver todas
          </Link>
        </p>
      )}

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
              {["Nombre", "Zona", "Alta", "Estado", "Gestión Operativa", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {residences.map((r) => {
              const badge = RESIDENCE_STATUS_BADGE[r.status] ?? { label: r.status, tone: "neutral" as const };
              const canToggle = r.status === "verified_active" || r.status === "paused_by_admin";
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    <Link href={`/admin/residences/${r.id}`} className="hover:underline" style={{ color: cmd.primary }}>
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.public_area ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                      {staleByResidence.has(r.id) && <AdminBadge tone="amber">Disponibilidad vencida</AdminBadge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={r.has_operational_management_access ? "emerald" : "neutral"}>
                      {r.has_operational_management_access ? "Con acceso" : "Sin acceso"}
                    </AdminBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col items-end gap-1.5">
                      {canToggle && <PauseResidenceControl residenceId={r.id} isPaused={r.status === "paused_by_admin"} />}
                      <OperationalAccessControl
                        residenceId={r.id}
                        hasAccess={r.has_operational_management_access}
                        expiresUntil={r.pioneer_free_access_until}
                      />
                    </div>
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
