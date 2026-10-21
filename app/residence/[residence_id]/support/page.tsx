import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { OpenCaseForm } from "@/app/residence/[residence_id]/support/OpenCaseForm";

export const metadata: Metadata = { title: "Soporte" };
export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { label: string; tone: "amber" | "sage" | "neutral" | "danger" }> = {
  opened: { label: "Abierto", tone: "amber" },
  submitted: { label: "Enviado", tone: "amber" },
  under_review: { label: "En revisión", tone: "amber" },
  needs_more_info: { label: "Necesitamos más info", tone: "amber" },
  waiting_other_party: { label: "Esperando a la otra parte", tone: "neutral" },
  in_progress: { label: "En curso", tone: "amber" },
  resolved_by_agreement: { label: "Resuelto por acuerdo", tone: "sage" },
  closed_no_action: { label: "Cerrado sin acción", tone: "neutral" },
  closed_unresolved: { label: "Cerrado sin resolución", tone: "danger" },
  admin_action_taken: { label: "EstuRed tomó una acción", tone: "sage" },
};

type CaseRow = {
  id: string;
  status: string;
  description: string;
  created_at: string;
  resolution_notes: string | null;
};

export default async function ResidenceSupportPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const { data: caseRows } = await admin
    .from("support_cases")
    .select("id, status, description, created_at, resolution_notes")
    .eq("residence_id", residenceId)
    .order("created_at", { ascending: false });
  const cases = (caseRows as unknown as CaseRow[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-ink">Soporte</h1>
      <p className="mt-1 text-ink-soft">Abrí un caso si algo no salió como esperabas con un estudiante o familiar.</p>

      <div className="mt-8">
        <OpenCaseForm residenceId={residenceId} />
      </div>

      {cases.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-ink">Casos de esta residencia</h2>
          <div className="mt-4 space-y-3">
            {cases.map((c) => {
              const badge = STATUS_COPY[c.status] ?? STATUS_COPY.opened;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    <p className="text-xs text-ink-faint">{formatDate(c.created_at)}</p>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{c.description}</p>
                  {c.resolution_notes && (
                    <p className="mt-2 rounded-field bg-cream-2 p-3 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">Respuesta de EstuRed: </span>
                      {c.resolution_notes}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
