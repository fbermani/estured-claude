import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { RESIDENCE_OFFER_STATUS_COPY } from "@/lib/renewals/statusCopy";

export const metadata: Metadata = { title: "Renovaciones" };
export const dynamic = "force-dynamic";

const OFFER_TONE: Record<string, "amber" | "emerald" | "neutral" | "rose"> = {
  amber: "amber",
  sage: "emerald",
  neutral: "neutral",
  danger: "rose",
};

const REQUEST_STATUS: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  created_by_student: { label: "Creada por el estudiante", tone: "neutral" },
  notified_to_residence: { label: "Notificada a la residencia", tone: "amber" },
  offer_received: { label: "Recibió oferta", tone: "emerald" },
  closed_no_offer: { label: "Cerrada sin oferta", tone: "neutral" },
  superseded_by_offer: { label: "Reemplazada por oferta", tone: "neutral" },
};

const PENDING_REQUEST_STATUSES = ["created_by_student", "notified_to_residence"];
const PENDING_OFFER_STATUSES = ["draft", "sent", "viewed"];

type PersonRow = { first_name: string; last_initial: string } | null;
type ResidenceRow = { name: string; public_area: string | null } | null;

type RequestRow = {
  id: string;
  status: string;
  created_at: string;
  student_profiles: PersonRow;
  residences: ResidenceRow;
};

type OfferRow = {
  id: string;
  status: string;
  period_start_date: string;
  monthly_price_usd: number;
  created_at: string;
  student_profiles: PersonRow;
  residences: ResidenceRow;
};

export default async function AdminRenewalsPage() {
  const admin = getSupabaseAdmin();

  const [{ data: requestsData, error: requestsError }, { data: offersData, error: offersError }] = admin
    ? await Promise.all([
        admin
          .from("renewal_requests")
          .select("id, status, created_at, student_profiles(first_name, last_initial), residences(name, public_area)")
          .order("created_at", { ascending: false })
          .limit(200),
        admin
          .from("renewal_offers")
          .select(
            "id, status, period_start_date, monthly_price_usd, created_at, student_profiles(first_name, last_initial), residences(name, public_area)",
          )
          .order("created_at", { ascending: false })
          .limit(200),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (requestsError) console.error("[admin/renewals] requests query failed:", requestsError);
  if (offersError) console.error("[admin/renewals] offers query failed:", offersError);

  const requests = (requestsData as unknown as RequestRow[]) ?? [];
  const offers = (offersData as unknown as OfferRow[]) ?? [];
  const pendingRequests = requests.filter((r) => PENDING_REQUEST_STATUSES.includes(r.status)).length;
  const pendingOffers = offers.filter((o) => PENDING_OFFER_STATUSES.includes(o.status)).length;

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Renovaciones
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        {pendingRequests} solicitud(es) esperando respuesta · {pendingOffers} oferta(s) sin cerrar, todas las
        residencias. Vista de solo lectura.
      </p>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        Solicitudes de renovación
      </h2>
      <AdminCard className="mt-2 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Fecha", "Estudiante", "Residencia", "Estado"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const badge = REQUEST_STATUS[r.status] ?? { label: r.status, tone: "neutral" as const };
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {r.student_profiles ? `${r.student_profiles.first_name} ${r.student_profiles.last_initial}.` : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.residences?.name}
                    {r.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {r.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {requests.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay solicitudes de renovación.
          </p>
        )}
      </AdminCard>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        Ofertas de renovación
      </h2>
      <AdminCard className="mt-2 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Fecha", "Estudiante", "Residencia", "Nuevo período desde", "USD/mes", "Estado"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => {
              const copy = RESIDENCE_OFFER_STATUS_COPY[o.status] ?? { label: o.status, tone: "neutral" as const };
              return (
                <tr key={o.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {new Date(o.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {o.student_profiles ? `${o.student_profiles.first_name} ${o.student_profiles.last_initial}.` : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {o.residences?.name}
                    {o.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {o.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {o.period_start_date}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {o.monthly_price_usd}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={OFFER_TONE[copy.tone]}>{copy.label}</AdminBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {offers.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay ofertas de renovación.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
