import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";

export const metadata: Metadata = { title: "Revocaciones del fee" };
export const dynamic = "force-dynamic";

const FEE_STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" }> = {
  paid: { label: "Pagado — sin reembolso", tone: "amber" },
  refunded: { label: "Reembolsado", tone: "emerald" },
};

type RevocationRow = {
  id: string;
  cancelled_at: string | null;
  residences: { name: string; public_area: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  // Hint de FK explícito: reservations ↔ estured_fee_payments tiene 2 FKs
  // (una en cada dirección) — el embed implícito es ambiguo y falla en
  // silencio (PGRST201) sin este hint. Ver MEMORY.md §10/§18.
  estured_fee_payments: {
    status: string;
    fee_amount_ars: number;
    refund_reason: string | null;
  } | null;
};

type AuditLogRow = {
  entity_id: string;
  actor_role: string;
  reason_text: string | null;
};

export default async function AdminRevocationsPage() {
  const admin = getSupabaseAdmin();

  const reservationsResult = admin
    ? await admin
        .from("reservations")
        .select(
          "id, cancelled_at, residences (name, public_area), student_profiles (first_name, last_initial), estured_fee_payments!reservations_estured_fee_payment_fk (status, fee_amount_ars, refund_reason)",
        )
        .eq("status", "cancelled_by_student")
        .eq("cancellation_reason_code", "student_revocation_right")
        .order("cancelled_at", { ascending: false })
    : { data: [], error: null };
  if (reservationsResult.error) {
    console.error("[admin-revocations] reservations query failed:", reservationsResult.error);
  }
  const revocations = (reservationsResult.data ?? []) as unknown as RevocationRow[];

  const reservationIds = revocations.map((r) => r.id);
  const logsResult =
    admin && reservationIds.length > 0
      ? await admin
          .from("audit_logs")
          .select("entity_id, actor_role, reason_text")
          .eq("action", "estured_fee_revoked")
          .eq("entity_type", "reservations")
          .in("entity_id", reservationIds)
      : { data: [], error: null };
  if (logsResult.error) console.error("[admin-revocations] audit_logs query failed:", logsResult.error);
  const logsByReservation = new Map<string, AuditLogRow>();
  for (const log of logsResult.data ?? []) logsByReservation.set(log.entity_id, log);

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Revocaciones del fee
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Ejercicios del botón de arrepentimiento (docs/10 §15.4). El fee permanece pagado hasta que EstuRed decida
        el reembolso — {revocations.length} caso(s) registrados.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Fecha", "Estudiante", "Residencia", "Monto del fee", "Estado del fee", "Motivo"].map((h) => (
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
            {revocations.map((r) => {
              const log = logsByReservation.get(r.id);
              const feeBadge = FEE_STATUS_BADGE[r.estured_fee_payments?.status ?? "paid"] ?? FEE_STATUS_BADGE.paid;
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {r.cancelled_at ? new Date(r.cancelled_at).toLocaleString("es-AR") : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {r.student_profiles
                      ? `${r.student_profiles.first_name} ${r.student_profiles.last_initial}.`
                      : "—"}
                    {log && (
                      <span className="block text-xs font-normal" style={{ color: cmd.outline }}>
                        solicitado por {log.actor_role === "family_member" ? "familiar" : "estudiante"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.residences?.name}
                    {r.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {r.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ color: cmd.onSurface }}>
                    {r.estured_fee_payments
                      ? `ARS ${Number(r.estured_fee_payments.fee_amount_ars).toLocaleString("es-AR")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={feeBadge.tone}>{feeBadge.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: cmd.outline }}>
                    {log?.reason_text || r.estured_fee_payments?.refund_reason || "Sin motivo indicado"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {revocations.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay revocaciones registradas.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
