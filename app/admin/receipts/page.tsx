import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { cmd } from "@/components/admin/ui/tokens";
import { ReissueForm } from "@/app/admin/receipts/ReissueForm";

export const metadata: Metadata = { title: "Comprobantes de reserva" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; tone: "emerald" | "neutral" | "rose" | "amber" }> = {
  issued: { label: "Vigente", tone: "emerald" },
  reissued: { label: "Reemitido", tone: "neutral" },
  voided: { label: "Anulado", tone: "rose" },
  pending_generation: { label: "Generando", tone: "amber" },
  generation_failed: { label: "Falló", tone: "rose" },
  not_available: { label: "No disponible", tone: "amber" },
};

type ReceiptRow = {
  id: string;
  status: string;
  receipt_number: string;
  issued_at: string | null;
  residences: { name: string; public_area: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
};

export default async function AdminReceiptsPage() {
  const admin = getSupabaseAdmin();

  const receiptsResult = admin
    ? await admin
        .from("booking_receipts")
        .select(
          "id, status, receipt_number, issued_at, residences (name, public_area), student_profiles (first_name, last_initial)",
        )
        .order("issued_at", { ascending: false })
    : { data: [], error: null };
  if (receiptsResult.error) console.error("[admin-receipts] query failed:", receiptsResult.error);
  const receipts = (receiptsResult.data ?? []) as unknown as ReceiptRow[];

  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Comprobantes de reserva
      </h1>
      <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
        Comprobantes de Reserva Confirmada emitidos — {receipts.length} en total. La reemisión genera un
        comprobante nuevo (número y código de verificación distintos) y marca el anterior como reemitido.
      </p>

      <AdminCard className="mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead style={{ backgroundColor: cmd.surfaceContainerLow, borderBottom: `1px solid ${cmd.border}` }}>
            <tr>
              {["Emitido", "Estudiante", "Residencia", "N.º comprobante", "Estado", "Acción"].map((h) => (
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
            {receipts.map((r) => {
              const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.not_available;
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {r.issued_at ? new Date(r.issued_at).toLocaleString("es-AR") : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: cmd.onSurface }}>
                    {r.student_profiles
                      ? `${r.student_profiles.first_name} ${r.student_profiles.last_initial}.`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: cmd.onSurfaceVariant }}>
                    {r.residences?.name}
                    {r.residences?.public_area && (
                      <span className="block text-xs" style={{ color: cmd.outline }}>
                        {r.residences.public_area}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: cmd.outline }}>
                    {r.receipt_number}
                  </td>
                  <td className="px-4 py-2.5">
                    <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === "issued" ? (
                      <ReissueForm receiptId={r.id} />
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
        {receipts.length === 0 && (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay comprobantes emitidos.
          </p>
        )}
      </AdminCard>
    </div>
  );
}
