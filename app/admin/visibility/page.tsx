import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { VisibilityControl } from "@/app/admin/visibility/VisibilityControl";
import type { QualityVisibilityStatus } from "@/lib/residences/setQualityVisibilityByAdmin";

export const metadata: Metadata = { title: "Visibilidad y penalizaciones" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<QualityVisibilityStatus, { label: string; tone: "emerald" | "amber" | "rose" }> = {
  normal_visibility: { label: "Visibilidad normal", tone: "emerald" },
  warning: { label: "Advertencia", tone: "amber" },
  reduced_visibility: { label: "Visibilidad reducida", tone: "rose" },
};

type ResidenceRow = {
  id: string;
  name: string;
  status: string;
  quality_visibility_status: QualityVisibilityStatus;
};

type NoteRow = { id: string; entity_id: string; reason_text: string | null; created_at: string; actor_role: string };

export default async function AdminVisibilityPage() {
  const admin = getSupabaseAdmin();

  let residences: ResidenceRow[] = [];
  let notesByResidence = new Map<string, NoteRow[]>();

  if (admin) {
    const { data, error } = await admin
      .from("residences")
      .select("id, name, status, quality_visibility_status")
      .order("name")
      .limit(200);
    if (error) console.error("[admin/visibility] residences query failed:", error);
    residences = (data as unknown as ResidenceRow[]) ?? [];

    if (residences.length > 0) {
      const { data: notes, error: notesError } = await admin
        .from("audit_logs")
        .select("id, entity_id, reason_text, created_at, actor_role")
        .eq("entity_type", "residences")
        .eq("action", "residence_internal_note_added")
        .in(
          "entity_id",
          residences.map((r) => r.id),
        )
        .order("created_at", { ascending: false });
      if (notesError) console.error("[admin/visibility] notes query failed:", notesError);
      notesByResidence = new Map();
      for (const note of (notes as unknown as NoteRow[]) ?? []) {
        const list = notesByResidence.get(note.entity_id) ?? [];
        list.push(note);
        notesByResidence.set(note.entity_id, list);
      }
    }
  }

  const flaggedCount = residences.filter((r) => r.quality_visibility_status !== "normal_visibility").length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Visibilidad y penalizaciones
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {flaggedCount > 0 ? `${flaggedCount} residencia(s) con advertencia o visibilidad reducida.` : "Ninguna residencia tiene penalizaciones activas."} Pausar,
        suspender o remover de la red se hace desde{" "}
        <Link href="/admin/residences" className="font-bold underline" style={{ color: cmd.primary }}>
          Residencias
        </Link>{" "}
        — acá solo se gestiona la señal de calidad.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
              <tr>
                {["Nombre", "Estado de visibilidad", "Notas internas", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {residences.map((r) => {
                const badge = STATUS_BADGE[r.quality_visibility_status];
                const notes = notesByResidence.get(r.id) ?? [];
                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                      {r.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                    </td>
                    <td className="px-4 py-2.5 align-top" style={{ color: cmd.onSurfaceVariant }}>
                      {notes.length === 0 ? (
                        <span className="text-xs" style={{ color: cmd.outline }}>
                          Sin notas
                        </span>
                      ) : (
                        <ul className="max-w-sm space-y-1.5">
                          {notes.slice(0, 3).map((n) => (
                            <li key={n.id} className="text-xs">
                              <span className="font-semibold" style={{ color: cmd.onSurface }}>
                                {formatDate(n.created_at)}:
                              </span>{" "}
                              {n.reason_text}
                            </li>
                          ))}
                          {notes.length > 3 && (
                            <li className="text-xs" style={{ color: cmd.outline }}>
                              +{notes.length - 3} más
                            </li>
                          )}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <VisibilityControl residenceId={r.id} currentStatus={r.quality_visibility_status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {residences.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay residencias registradas.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
