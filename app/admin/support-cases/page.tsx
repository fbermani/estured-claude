import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { DocumentAccessButton } from "@/components/admin/ui/DocumentAccessButton";
import { UpdateCaseForm } from "@/app/admin/support-cases/UpdateCaseForm";

export const metadata: Metadata = { title: "Casos de soporte" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; tone: "amber" | "emerald" | "neutral" | "rose" }> = {
  opened: { label: "Abierto", tone: "amber" },
  submitted: { label: "Enviado", tone: "amber" },
  under_review: { label: "En revisión", tone: "amber" },
  needs_more_info: { label: "Necesitamos más info", tone: "amber" },
  waiting_other_party: { label: "Esperando a la otra parte", tone: "neutral" },
  in_progress: { label: "En curso", tone: "amber" },
  resolved_by_agreement: { label: "Resuelto por acuerdo", tone: "emerald" },
  closed_no_action: { label: "Cerrado sin acción", tone: "neutral" },
  closed_unresolved: { label: "Cerrado sin resolución", tone: "rose" },
  admin_action_taken: { label: "Acción tomada", tone: "emerald" },
};
const OPEN_STATUSES = [
  "opened",
  "submitted",
  "under_review",
  "needs_more_info",
  "waiting_other_party",
  "in_progress",
];

interface CaseRow {
  id: string;
  status: string;
  description: string;
  created_at: string;
  resolution_outcome: string | null;
  resolution_notes: string | null;
  opened_by_role: string;
  users: { email: string } | null;
  residences: { name: string; public_area: string } | null;
}

export default async function AdminSupportCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: selectedId } = await searchParams;
  const admin = getSupabaseAdmin();

  const cases: CaseRow[] = admin
    ? (((
        await admin
          .from("support_cases")
          .select(
            "id, status, description, created_at, resolution_outcome, resolution_notes, opened_by_role, users!support_cases_opened_by_user_id_fkey(email), residences(name, public_area)",
          )
          .order("created_at", { ascending: false })
      ).data as unknown as CaseRow[]) ?? [])
    : [];

  const activeId = selectedId ?? cases[0]?.id ?? null;
  const detail = cases.find((c) => c.id === activeId) ?? null;
  const openCount = cases.filter((c) => OPEN_STATUSES.includes(c.status)).length;

  // El signed URL ya NO se genera acá (docs/09 §18.2: requiere
  // justificación auditada antes de verse) — `DocumentAccessButton`
  // pide el motivo y genera el link recién ahí.
  let evidence: { fileId: string; filename: string }[] = [];
  if (admin && detail) {
    const { data: files } = await admin
      .from("files")
      .select("id, filename")
      .eq("related_entity_type", "support_cases")
      .eq("related_entity_id", detail.id);
    evidence = (files ?? []).map((f) => ({ fileId: f.id, filename: f.filename }));
  }

  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            Casos de soporte
          </h1>
          <p className="text-xs" style={{ color: cmd.outline }}>
            {openCount} abierto(s) de {cases.length} en total
          </p>
        </div>
        {cases.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>
            Todavía no hay casos de soporte.
          </p>
        ) : (
          <ul>
            {cases.map((c) => {
              const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.opened;
              const active = c.id === activeId;
              return (
                <li key={c.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/support-cases?id=${c.id}`}
                    className="block px-4 py-3"
                    style={active ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                      <span className="text-xs" style={{ color: cmd.outline }}>
                        {new Date(c.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {c.residences?.name}
                    </p>
                    <p className="truncate text-xs" style={{ color: cmd.outline }}>
                      {c.users?.email}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {detail ? (
          <AdminCard className="max-w-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  {detail.residences?.name} · {detail.residences?.public_area}
                </p>
                <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  Abierto por {detail.users?.email} ({detail.opened_by_role})
                </p>
              </div>
              <AdminBadge tone={(STATUS_BADGE[detail.status] ?? STATUS_BADGE.opened).tone}>
                {(STATUS_BADGE[detail.status] ?? STATUS_BADGE.opened).label}
              </AdminBadge>
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm" style={{ color: cmd.onSurface }}>
              {detail.description}
            </p>

            {evidence.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  Evidencia
                </p>
                <ul className="mt-1 space-y-1">
                  {evidence.map((f) => (
                    <li key={f.fileId}>
                      <span className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                        {f.filename}
                      </span>{" "}
                      <DocumentAccessButton fileId={f.fileId} label="Ver →" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.resolution_notes && (
              <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: cmd.surfaceContainerLow }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                  Última resolución {detail.resolution_outcome && `— ${detail.resolution_outcome}`}
                </p>
                <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  {detail.resolution_notes}
                </p>
              </div>
            )}

            <UpdateCaseForm supportCaseId={detail.id} currentStatus={detail.status} />
          </AdminCard>
        ) : (
          <p className="text-sm" style={{ color: cmd.outline }}>
            Elegí un caso de la lista.
          </p>
        )}
      </div>
    </div>
  );
}
