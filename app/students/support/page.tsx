import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { loadFeeSupportContext } from "@/lib/support/openSupportCase";
import { reservationReference } from "@/lib/payments/feeTransferPresentation";
import { FeePaymentCaseForm } from "@/app/students/support/FeePaymentCaseForm";
import { OpenCaseForm } from "@/app/students/support/OpenCaseForm";

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
  residences: { name: string } | null;
  /** Caso "problema con el pago del fee" (migración 0040): sin residencia, con la reserva como contexto. */
  related_entity_type: string | null;
  related_entity_id: string | null;
  /** `fee_revocation` (migración 0049, DR6): caso que se abre solo al revocar el fee. */
  topic: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; reserva?: string }>;
}) {
  const { motivo, reserva } = await searchParams;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/students/support");

  const admin = getSupabaseAdmin();
  const { data: studentProfile } = admin
    ? await admin.from("student_profiles").select("id").eq("user_id", sessionUser.id).maybeSingle()
    : { data: null };

  let residences: { id: string; name: string }[] = [];
  let cases: CaseRow[] = [];

  if (admin && studentProfile) {
    const [{ data: apps }, { data: reservations }, { data: caseRows }] = await Promise.all([
      admin.from("application_requests").select("residences(id, name)").eq("student_profile_id", studentProfile.id),
      admin.from("reservations").select("residences(id, name)").eq("student_profile_id", studentProfile.id),
      admin
        .from("support_cases")
        .select("id, status, description, created_at, resolution_notes, related_entity_type, related_entity_id, topic, residences(name)")
        .eq("opened_by_user_id", sessionUser.id)
        .order("created_at", { ascending: false }),
    ]);

    const seen = new Map<string, string>();
    for (const row of [...(apps ?? []), ...(reservations ?? [])]) {
      const r = row.residences as unknown as { id: string; name: string } | null;
      if (r) seen.set(r.id, r.name);
    }
    residences = [...seen.entries()].map(([id, name]) => ({ id, name }));
    cases = (caseRows as unknown as CaseRow[]) ?? [];
  }

  // "Tengo un problema con el pago": solo si la reserva es del usuario (pagador o estudiante beneficiario).
  const feeContext =
    admin && motivo === "pago-fee" && reserva && UUID_RE.test(reserva)
      ? await loadFeeSupportContext(admin, sessionUser.id, reserva)
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-ink">Soporte</h1>
      <p className="mt-1 text-ink-soft">Abrí un caso si algo no salió como esperabas con una residencia.</p>

      <div className="mt-8">
        {feeContext ? (
          <FeePaymentCaseForm
            reservationId={feeContext.reservationId}
            reference={reservationReference(feeContext.reservationId)}
            residenceName={feeContext.residenceName}
            defaultDescription={`Tengo un problema con el pago del fee EstuRed (referencia ${reservationReference(feeContext.reservationId)}). `}
          />
        ) : residences.length === 0 ? (
          <EmptyState
            icon="support_agent"
            title="Todavía no tenés residencias vinculadas"
            description="Cuando envíes una solicitud o tengas una reserva, vas a poder abrir un caso sobre esa residencia."
          />
        ) : (
          <OpenCaseForm residences={residences} />
        )}
      </div>

      {cases.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-ink">Tus casos</h2>
          <div className="mt-4 space-y-3">
            {cases.map((c) => {
              const badge = STATUS_COPY[c.status] ?? STATUS_COPY.opened;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-ink">
                      {c.topic === "fee_revocation"
                        ? "Revocación del fee EstuRed"
                        : c.topic === "residence_payment"
                          ? `Pago de la reserva${c.residences?.name ? ` en ${c.residences.name}` : ""}`
                          : (c.residences?.name ?? (c.related_entity_type === "reservations" ? "Pago del fee EstuRed" : "Residencia"))}
                    </p>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{c.description}</p>
                  {c.resolution_notes && (
                    <p className="mt-2 rounded-field bg-cream-2 p-3 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">Respuesta de EstuRed: </span>
                      {c.resolution_notes}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink-faint">{formatDate(c.created_at)}</p>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
