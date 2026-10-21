import { formatDate, formatDateTime } from "@/lib/dates/format";
import { formatShortName } from "@/lib/format/shortName";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";


type ProposalRow = {
  id: string;
  proposed_monthly_price_usd: number | null;
  student_response: string | null;
  student_response_at: string | null;
  expires_at: string;
  created_at: string;
  application_requests: {
    student_profiles: { first_name: string; last_initial: string } | null;
    residences: { name: string; public_area: string | null } | null;
  } | null;
};

function statusOf(p: ProposalRow, nowIso: string): { label: string; tone: "amber" | "emerald" | "neutral" | "rose" } {
  if (p.student_response === "accepted") return { label: "Aceptada", tone: "emerald" };
  if (p.student_response === "rejected_chose_original") return { label: "Rechazada (mantuvo original)", tone: "neutral" };
  if (p.student_response === "rejected_closed") return { label: "Rechazada (cerró solicitud)", tone: "rose" };
  if (p.expires_at <= nowIso) return { label: "Vencida", tone: "neutral" };
  return { label: "Pendiente", tone: "amber" };
}

export async function NegotiationsView() {
  const admin = getSupabaseAdmin();

  const { data, error } = admin
    ? await admin
        .from("application_negotiation_proposals")
        .select(
          "id, proposed_monthly_price_usd, student_response, student_response_at, expires_at, created_at, application_requests(student_profiles(first_name, last_initial), residences(name, public_area))",
        )
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [], error: null };
  if (error) console.error("[admin/negotiations] query failed:", error);
  const proposals = (data as unknown as ProposalRow[]) ?? [];
  const nowIso = new Date().toISOString();
  const pendingCount = proposals.filter((p) => statusOf(p, nowIso).label === "Pendiente").length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Negociaciones
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {pendingCount} pendiente(s) de {proposals.length} propuesta(s) en total, todas las residencias. Vista de
        solo lectura.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Enviada", "Estudiante", "Residencia", "Precio propuesto (USD)", "Vence", "Estado"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: cmd.outline }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => {
              const badge = statusOf(p, nowIso);
              const app = p.application_requests;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {app?.student_profiles ? `${formatShortName(app.student_profiles.first_name, app.student_profiles.last_initial)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {app?.residences?.name}
                    {app?.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {app.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {p.proposed_monthly_price_usd != null ? `USD ${p.proposed_monthly_price_usd}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {formatDateTime(p.expires_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {proposals.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay propuestas de negociación en el sistema.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
