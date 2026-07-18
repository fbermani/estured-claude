import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ResidentModerationActions } from "@/app/admin/community/ResidentModerationActions";

export const metadata: Metadata = { title: "Administración de comunidad" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; tone: "amber" | "emerald" | "rose" | "neutral" }> = {
  created_by_residence: { label: "Cargado, sin invitar", tone: "amber" },
  pending_activation: { label: "Pendiente de activación", tone: "amber" },
  active: { label: "Activo", tone: "emerald" },
  visibility_limited: { label: "Visibilidad limitada (admin)", tone: "rose" },
  hidden_by_user: { label: "Oculto por el usuario", tone: "neutral" },
  inactive: { label: "Inactivo", tone: "neutral" },
};

type StayRow = {
  id: string;
  status: string;
  residences: { name: string; public_area: string | null } | null;
  rooms: { label: string } | null;
  room_types: { name: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
};

export default async function AdminCommunityPage() {
  const admin = getSupabaseAdmin();

  let stays: StayRow[] = [];
  if (admin) {
    const { data } = await admin
      .from("resident_stays")
      .select("id, status, residences(name, public_area), rooms(label), room_types(name), student_profiles(first_name, last_initial)")
      .eq("is_current", true)
      .order("created_at", { ascending: false })
      .limit(300);
    stays = (data as unknown as StayRow[]) ?? [];
  }

  const limitedCount = stays.filter((s) => s.status === "visibility_limited").length;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
            Administración de Comunidad
          </h1>
          <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
            Visibilidad y estado de los residentes activos en la comunidad de cada residencia.
          </p>
        </div>
        {limitedCount > 0 && <AdminBadge tone="rose">{limitedCount} con visibilidad limitada</AdminBadge>}
      </div>

      <AdminCard className="overflow-hidden p-0">
        {stays.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            No hay residentes cargados todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ backgroundColor: cmd.surfaceContainer }}>
                <tr>
                  {["Residencia", "Habitación", "Residente", "Estado", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: cmd.outline }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: cmd.border }}>
                {stays.map((s) => {
                  const status = STATUS_LABELS[s.status] ?? STATUS_LABELS.pending_activation;
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-bold" style={{ color: cmd.onSurface }}>
                        {s.residences?.name ?? "—"}
                        <span className="ml-1 font-normal" style={{ color: cmd.outline }}>
                          · {s.residences?.public_area ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                        {s.rooms?.label ?? s.room_types?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                        {s.student_profiles ? `${s.student_profiles.first_name} ${s.student_profiles.last_initial}.` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <AdminBadge tone={status.tone}>{status.label}</AdminBadge>
                      </td>
                      <td className="px-4 py-3">
                        {["active", "visibility_limited", "hidden_by_user"].includes(s.status) ? (
                          <ResidentModerationActions residentStayId={s.id} status={s.status} />
                        ) : (
                          <span className="text-xs" style={{ color: cmd.outline }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
