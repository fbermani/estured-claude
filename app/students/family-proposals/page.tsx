import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FamilyProposalActions } from "@/app/students/family-proposals/FamilyProposalActions";

export const metadata: Metadata = { title: "Propuestas de tu familiar" };
export const dynamic = "force-dynamic";

interface ProposalRow {
  id: string;
  status: string;
  desired_start_date: string;
  initial_duration_months: number;
  message_to_student: string | null;
  expires_at: string;
  created_at: string;
  residences: { name: string; public_area: string } | null;
  room_types: { name: string; monthly_price_usd: number } | null;
  family_members: { first_name: string; last_name: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  approved_by_student: "Aprobada",
  rejected_by_student: "Rechazada",
  expired: "Vencida",
};

export default async function FamilyProposalsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const { data: studentProfile } = await admin
    .from("student_profiles")
    .select("id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();
  if (!studentProfile) notFound();

  const { data } = await admin
    .from("family_application_proposals")
    .select(
      "id, status, desired_start_date, initial_duration_months, message_to_student, expires_at, created_at, residences(name, public_area), room_types(name, monthly_price_usd), family_members(first_name, last_name)",
    )
    .eq("student_profile_id", studentProfile.id)
    .order("created_at", { ascending: false });
  const proposals = (data as unknown as ProposalRow[]) ?? [];
  const rate = await getCurrentExchangeRate();
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-petrol-800">Propuestas de tu familiar</h1>
      <p className="mt-2 text-ink-soft">
        Residencias que tu familiar te sugirió. Tenés 48 horas para aprobar o rechazar cada una.
      </p>

      {proposals.length === 0 ? (
        <Card className="mt-8 p-6 text-sm text-ink-soft">Todavía no tenés propuestas.</Card>
      ) : (
        <div className="mt-8 space-y-4">
          {proposals.map((p) => {
            const isPending = p.status === "pending_student_approval";
            const isExpired = isPending && new Date(p.expires_at) < now;
            const hoursLeft = Math.max(0, Math.round((new Date(p.expires_at).getTime() - now.getTime()) / 3_600_000));
            const monthlyUsd = Number(p.room_types?.monthly_price_usd ?? 0);

            return (
              <Card key={p.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-petrol-800">{p.residences?.name}</h2>
                    <p className="text-sm text-ink-soft">
                      {p.residences?.public_area}, CABA · {p.room_types?.name}
                    </p>
                  </div>
                  <Badge tone={isExpired ? "neutral" : isPending ? "amber" : p.status === "approved_by_student" ? "sage" : "neutral"}>
                    {isExpired ? "Vencida" : isPending ? "Pendiente" : STATUS_LABEL[p.status]}
                  </Badge>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Fecha de ingreso propuesta</dt>
                    <dd className="font-medium text-ink">{p.desired_start_date}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Duración propuesta</dt>
                    <dd className="font-medium text-ink">{p.initial_duration_months} meses</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Precio referencial</dt>
                    <dd className="font-medium text-ink">
                      {formatUsd(monthlyUsd)} ≈ {formatArs(usdToArs(monthlyUsd, rate.arsPerUsd))}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Sugerida por</dt>
                    <dd className="font-medium text-ink">
                      {p.family_members?.first_name} {p.family_members?.last_name}
                    </dd>
                  </div>
                </dl>

                {p.message_to_student && (
                  <p className="mt-3 rounded-field bg-sand-100 px-3 py-2 text-sm text-ink-soft">
                    “{p.message_to_student}”
                  </p>
                )}

                {isPending && !isExpired && (
                  <p className="mt-3 text-xs font-medium text-warning-fg">
                    Te quedan {hoursLeft} horas para responder.
                  </p>
                )}

                {isPending && !isExpired && <FamilyProposalActions proposalId={p.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
