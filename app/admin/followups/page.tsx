import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { QueueLayout } from "@/components/admin/ui/QueueLayout";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { createAuditLog } from "@/lib/audit";
import { adminActorRole } from "@/lib/auth/requireAdmin";
import { formatDate } from "@/lib/dates/format";
import { formatDateOnly } from "@/lib/students/contractEnd";
import {
  FOLLOWUP_STATUS_LABELS,
  howIsItGoingLabel,
  wasAsExpectedLabel,
  type StayFollowupStatus,
} from "@/lib/followups/common";
import { DEFAULT_COMMUNICATION_TEXT } from "@/lib/followups/adminActions";
import { CommunicateForm, ReviewForm } from "@/app/admin/followups/FollowupAdminForms";

export const metadata: Metadata = { title: "Seguimiento post-ingreso" };
export const dynamic = "force-dynamic";

const TONES: Record<StayFollowupStatus, "amber" | "emerald" | "neutral" | "rose" | "violet" | "primary"> = {
  scheduled: "neutral",
  sent: "amber",
  answered: "violet",
  no_response: "rose",
  reviewed: "emerald",
  cancelled: "neutral",
};
const FILTERS: StayFollowupStatus[] = ["scheduled", "sent", "answered", "no_response", "reviewed", "cancelled"];

type Row = {
  id: string;
  status: StayFollowupStatus;
  due_at: string;
  student_profile_id: string | null;
  residence_id: string;
  resident_stay_id: string;
  reviewed_at: string | null;
  admin_note: string | null;
  communicated_to_residence: boolean;
};
type Response = { respondent_role: string; how_is_it_going: string; was_as_expected: string; comment: string | null; answered_at: string };

/** Seguimiento post-ingreso (DR14, docs/08 §8.18). Solo admin/superadmin; abrir el detalle (con las respuestas) queda auditado. */
export default async function AdminFollowupsPage({ searchParams }: { searchParams: Promise<{ estado?: string; id?: string }> }) {
  const user = await requireAdmin();
  const { estado, id } = await searchParams;
  const admin = getSupabaseAdmin();
  if (!admin) return <p className="p-6 text-sm">No disponible en este momento.</p>;

  const query = admin
    .from("stay_followups")
    .select("id, status, due_at, student_profile_id, residence_id, resident_stay_id, reviewed_at, admin_note, communicated_to_residence")
    .order("due_at", { ascending: false })
    .limit(200);
  const filter = FILTERS.includes(estado as StayFollowupStatus) ? (estado as StayFollowupStatus) : null;
  const { data, error } = filter ? await query.eq("status", filter) : await query;
  if (error) {
    const missing = error.code === "PGRST205" || error.code === "42P01";
    return (
      <div className="p-6">
        <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>Seguimiento post-ingreso</h1>
        <p className="mt-2 text-sm" style={{ color: cmd.outline }}>
          {missing ? "Todavía no está disponible: falta aplicar la migración 0055." : "No pudimos cargar los seguimientos. Probá de nuevo."}
        </p>
      </div>
    );
  }
  const rows = (data ?? []) as Row[];

  const residenceIds = [...new Set(rows.map((r) => r.residence_id))];
  const profileIds = [...new Set(rows.map((r) => r.student_profile_id).filter((x): x is string => !!x))];
  const stayIds = rows.map((r) => r.resident_stay_id);
  const [{ data: residences }, { data: profiles }, { data: stays }] = await Promise.all([
    residenceIds.length ? admin.from("residences").select("id, name").in("id", residenceIds) : Promise.resolve({ data: [] }),
    profileIds.length ? admin.from("student_profiles").select("id, first_name, last_initial, is_minor").in("id", profileIds) : Promise.resolve({ data: [] }),
    stayIds.length ? admin.from("resident_stays").select("id, start_date").in("id", stayIds) : Promise.resolve({ data: [] }),
  ]);
  const residenceName = new Map((residences ?? []).map((r) => [r.id as string, r.name as string]));
  const profileName = new Map((profiles ?? []).map((p) => [p.id as string, `${p.first_name ?? ""} ${p.last_initial ?? ""}`.trim()]));
  const startDate = new Map((stays ?? []).map((s) => [s.id as string, s.start_date as string | null]));

  const detail = rows.find((r) => r.id === id) ?? null;
  let responses: Response[] = [];
  if (detail) {
    const { data: resp } = await admin
      .from("stay_followup_responses")
      .select("respondent_role, how_is_it_going, was_as_expected, comment, answered_at")
      .eq("stay_followup_id", detail.id)
      .order("answered_at", { ascending: true });
    responses = (resp ?? []) as Response[];
    await createAuditLog(admin, {
      actorUserId: user.id,
      actorRole: adminActorRole(user),
      action: "stay_followup_viewed",
      entityType: "stay_followup",
      entityId: detail.id,
      source: "admin",
    });
  }

  return (
    <QueueLayout
      explicit={Boolean(id)}
      detailClassName="p-4 sm:p-5 xl:p-6"
      backHref={`/admin/followups${filter ? `?estado=${filter}` : ""}`}
      queue={
        <>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>Seguimiento post-ingreso</h1>
          <p className="text-xs" style={{ color: cmd.outline }}>A los 5 días del ingreso. La residencia no ve esta pantalla.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link href="/admin/followups" className="inline-flex min-h-11 items-center rounded-full px-3 py-1 text-xs font-bold xl:min-h-0" style={{ border: `1.5px solid ${cmd.border}`, color: filter ? cmd.outline : cmd.onSurface }}>Todos</Link>
            {FILTERS.map((f) => (
              <Link key={f} href={`/admin/followups?estado=${f}`} className="inline-flex min-h-11 items-center rounded-full px-3 py-1 text-xs font-bold xl:min-h-0" style={{ border: `1.5px solid ${cmd.border}`, color: filter === f ? cmd.onSurface : cmd.outline }}>
                {FOLLOWUP_STATUS_LABELS[f]}
              </Link>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>No hay seguimientos para mostrar.</p>
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                <Link href={`/admin/followups?${filter ? `estado=${filter}&` : ""}id=${r.id}`} className="block p-4" style={{ backgroundColor: r.id === detail?.id ? cmd.surfaceContainer : undefined }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {(r.student_profile_id && profileName.get(r.student_profile_id)) || "Sin cuenta de estudiante"}
                    </span>
                    <AdminBadge tone={TONES[r.status]}>{FOLLOWUP_STATUS_LABELS[r.status]}</AdminBadge>
                  </div>
                  <p className="text-xs" style={{ color: cmd.outline }}>
                    {residenceName.get(r.residence_id) ?? "Residencia"} · ingreso {startDate.get(r.resident_stay_id) ? formatDateOnly(startDate.get(r.resident_stay_id) as string) : "s/d"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        </>
      }
      detail={
        <>
        {!detail ? (
          <p className="text-sm" style={{ color: cmd.outline }}>Elegí un seguimiento para ver las respuestas.</p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
                {(detail.student_profile_id && profileName.get(detail.student_profile_id)) || "Sin cuenta de estudiante"} · {residenceName.get(detail.residence_id)}
              </h2>
              <p className="text-xs" style={{ color: cmd.outline }}>
                Estado: {FOLLOWUP_STATUS_LABELS[detail.status]} · corresponde desde {formatDate(detail.due_at)}
                {detail.communicated_to_residence ? " · ya se comunicó algo a la residencia" : ""}
              </p>
            </div>
            <AdminCard className="space-y-3 p-4">
              {responses.length === 0 ? (
                <p className="text-sm" style={{ color: cmd.outline }}>
                  {detail.student_profile_id ? "Todavía no hay respuestas." : "La estadía no tiene cuenta de estudiante: solo se avisó a la residencia, no hay encuesta."}
                </p>
              ) : (
                responses.map((r) => (
                  <div key={r.respondent_role} className="text-sm" style={{ color: cmd.onSurface }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                      {r.respondent_role === "guardian" ? "Guardián" : "Estudiante"} · {formatDate(r.answered_at)}
                    </p>
                    <p>¿Cómo va todo? <strong>{howIsItGoingLabel(r.how_is_it_going)}</strong></p>
                    <p>¿Era lo esperado? <strong>{wasAsExpectedLabel(r.was_as_expected)}</strong></p>
                    {r.comment && <p className="mt-1 whitespace-pre-line">&ldquo;{r.comment}&rdquo;</p>}
                  </div>
                ))
              )}
            </AdminCard>
            {detail.status === "reviewed" && detail.admin_note && (
              <p className="text-sm" style={{ color: cmd.onSurface }}>
                <strong>Nota interna:</strong> {detail.admin_note}
              </p>
            )}
            {detail.status === "answered" && <ReviewForm followupId={detail.id} />}
            {(detail.status === "answered" || detail.status === "reviewed") && (
              <CommunicateForm followupId={detail.id} defaultText={DEFAULT_COMMUNICATION_TEXT} alreadyCommunicated={detail.communicated_to_residence} />
            )}
          </div>
        )}
        </>
      }
    />
  );
}
