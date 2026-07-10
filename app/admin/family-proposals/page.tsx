import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";

export const metadata: Metadata = { title: "Propuestas del familiar" };
export const dynamic = "force-dynamic";

interface ProposalRow {
  id: string;
  status: string;
  created_at: string;
  expires_at: string;
  student_response_at: string | null;
  message_to_student: string | null;
  rejection_reason: string | null;
  desired_start_date: string;
  initial_duration_months: number;
  family_members: { first_name: string; last_name: string } | null;
  student_profiles: { first_name: string; last_initial: string } | null;
  residences: { name: string; public_area: string } | null;
  room_types: { name: string } | null;
}

const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "rose" | "neutral" }> = {
  pending_student_approval: { label: "Pendiente", tone: "amber" },
  approved_by_student: { label: "Aprobada", tone: "emerald" },
  rejected_by_student: { label: "Rechazada", tone: "rose" },
  expired: { label: "Vencida", tone: "neutral" },
};

function responseTime(proposal: ProposalRow): string {
  if (!proposal.student_response_at) {
    if (proposal.status === "pending_student_approval" && new Date(proposal.expires_at) < new Date()) {
      return "Vencida sin respuesta";
    }
    return proposal.status === "pending_student_approval" ? "Esperando respuesta" : "—";
  }
  const hours = Math.round(
    (new Date(proposal.student_response_at).getTime() - new Date(proposal.created_at).getTime()) / 3_600_000,
  );
  return hours < 1 ? "< 1 hora" : `${hours} horas`;
}

export default async function AdminFamilyProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: selectedId } = await searchParams;
  const admin = getSupabaseAdmin();

  const proposals: ProposalRow[] = admin
    ? (((
        await admin
          .from("family_application_proposals")
          .select(
            "id, status, created_at, expires_at, student_response_at, message_to_student, rejection_reason, desired_start_date, initial_duration_months, family_members(first_name, last_name), student_profiles(first_name, last_initial), residences(name, public_area), room_types(name)",
          )
          .order("created_at", { ascending: false })
      ).data as unknown as ProposalRow[]) ?? [])
    : [];

  const activeId = selectedId ?? proposals[0]?.id ?? null;
  const detail = proposals.find((p) => p.id === activeId) ?? null;

  // Docs/08 §8.7: detectar familiares con muchas propuestas rechazadas.
  const rejectedByFamily = new Map<string, number>();
  for (const p of proposals) {
    if (p.status !== "rejected_by_student" || !p.family_members) continue;
    const key = `${p.family_members.first_name} ${p.family_members.last_name}`;
    rejectedByFamily.set(key, (rejectedByFamily.get(key) ?? 0) + 1);
  }

  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            Propuestas del familiar
          </h1>
          <p className="text-xs" style={{ color: cmd.outline }}>
            {proposals.length} en total
          </p>
        </div>
        {proposals.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay propuestas del familiar.
          </p>
        ) : (
          <ul>
            {proposals.map((p) => {
              const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.pending_student_approval;
              const active = p.id === activeId;
              return (
                <li key={p.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/family-proposals?id=${p.id}`}
                    className="block px-4 py-3"
                    style={active ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                      <span className="text-xs" style={{ color: cmd.outline }}>
                        {new Date(p.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {p.family_members?.first_name} {p.family_members?.last_name} → {p.student_profiles?.first_name}{" "}
                      {p.student_profiles?.last_initial}
                    </p>
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {p.residences?.name}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {[...rejectedByFamily.entries()].some(([, count]) => count >= 2) && (
          <div className="mb-6 rounded-lg bg-white p-4" style={{ border: `1px solid ${cmd.rose}` }}>
            <p className="text-sm font-semibold" style={{ color: cmd.rose }}>
              Familiares con 2 o más propuestas rechazadas:{" "}
              {[...rejectedByFamily.entries()]
                .filter(([, count]) => count >= 2)
                .map(([name, count]) => `${name} (${count})`)
                .join(", ")}
            </p>
          </div>
        )}

        {detail ? (
          <AdminCard className="max-w-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
                {detail.family_members?.first_name} {detail.family_members?.last_name} →{" "}
                {detail.student_profiles?.first_name} {detail.student_profiles?.last_initial}
              </h2>
              <AdminBadge tone={(STATUS_BADGE[detail.status] ?? STATUS_BADGE.pending_student_approval).tone}>
                {(STATUS_BADGE[detail.status] ?? STATUS_BADGE.pending_student_approval).label}
              </AdminBadge>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt style={{ color: cmd.outline }}>Residencia</dt>
                <dd style={{ color: cmd.onSurface }}>
                  {detail.residences?.name} · {detail.residences?.public_area}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: cmd.outline }}>Tipo de habitación</dt>
                <dd style={{ color: cmd.onSurface }}>{detail.room_types?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: cmd.outline }}>Fecha de ingreso propuesta</dt>
                <dd style={{ color: cmd.onSurface }}>{detail.desired_start_date}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: cmd.outline }}>Duración propuesta</dt>
                <dd style={{ color: cmd.onSurface }}>{detail.initial_duration_months} meses</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: cmd.outline }}>Enviada</dt>
                <dd style={{ color: cmd.onSurface }}>{new Date(detail.created_at).toLocaleString("es-AR")}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: cmd.outline }}>Tiempo de respuesta</dt>
                <dd style={{ color: cmd.onSurface }}>{responseTime(detail)}</dd>
              </div>
            </dl>
            {detail.message_to_student && (
              <p className="mt-4 rounded border p-3 text-sm" style={{ borderColor: cmd.border, color: cmd.onSurfaceVariant }}>
                <span className="font-semibold">Mensaje del familiar:</span> “{detail.message_to_student}”
              </p>
            )}
            {detail.rejection_reason && (
              <p className="mt-3 rounded border p-3 text-sm" style={{ borderColor: cmd.rose, color: cmd.rose }}>
                <span className="font-semibold">Motivo del rechazo:</span> {detail.rejection_reason}
              </p>
            )}
          </AdminCard>
        ) : (
          <AdminCard className="p-8 text-center">
            <p className="text-sm" style={{ color: cmd.outline }}>
              Seleccioná una propuesta de la lista para ver el detalle.
            </p>
          </AdminCard>
        )}
      </div>
    </div>
  );
}
