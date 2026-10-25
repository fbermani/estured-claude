import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { loadTeamSnapshot } from "@/lib/team/teamInvitations";
import { MAX_STAFF_PER_RESIDENCE, INVITATION_TTL_DAYS } from "@/lib/team/teamRules";
import { formatDate } from "@/lib/dates/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { InviteForm, InvitationControls, RemoveMemberControl, StaffPermissionsPanel } from "@/app/residence/[residence_id]/team/TeamControls";

export const metadata: Metadata = { title: "Equipo" };
export const dynamic = "force-dynamic";

/**
 * Equipo de la residencia (DR10/DR11, docs/08 §7.20): SOLO el dueño. Lista de miembros con los permisos de cada staff, invitar por email
 * (siempre rol staff, con los permisos iniciales que elige el dueño), invitaciones pendientes (reenviar / cancelar) y quitar acceso. El staff que llega por la URL ve un aviso, no la pantalla.
 */
export default async function ResidenceTeamPage({ params }: { params: Promise<{ residence_id: string }> }) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();

  if (membership.role !== "owner") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <EmptyState
          icon="lock"
          title="Esta sección es solo para el dueño de la residencia"
          description="El dueño es quien suma o quita a las personas del equipo. Si necesitás que alguien más tenga acceso, pedíselo a él."
        />
      </div>
    );
  }

  const [snapshot, { data: residence }] = await Promise.all([
    loadTeamSnapshot(admin, residenceId),
    admin.from("residences").select("name").eq("id", residenceId).maybeSingle(),
  ]);
  const residenceName = (residence as { name?: string } | null)?.name ?? "tu residencia";

  if (!snapshot.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold text-ink">Equipo</h1>
        <div className="mt-6">
          <EmptyState icon="error" title="No pudimos cargar el equipo" description={`${snapshot.error} Recargá la página para intentar de nuevo.`} />
        </div>
      </div>
    );
  }

  const { members, invitations } = snapshot;
  const invitationsAvailable = invitations !== null;
  const pending = invitations ?? [];
  const staffCount = members.filter((m) => m.role === "staff").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Equipo</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Las personas que trabajan con vos en <span className="font-semibold text-ink">{residenceName}</span>. Cada residencia tiene su propio equipo.
      </p>

      <Card className="mt-6 border-forest-tint bg-forest-tint/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Icon name="info" className="text-lg text-forest-700" />
          Cómo funcionan los permisos
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          Vos elegís, staff por staff, qué puede hacer: revisar y rechazar solicitudes, el pago a la residencia, habitaciones y disponibilidad, residentes,
          renovaciones, lista de espera, preguntas y, si querés, proponer ajustes o editar el perfil. Todo staff activo puede ver el panel y las pantallas en
          solo lectura, abrir un caso de Soporte y recibir avisos. Gestionar el equipo y sus permisos, enviar el perfil a verificación, sumar otra
          residencia y el reporte PDF son solo tuyos.
        </p>
      </Card>

      <section className="mt-8" aria-labelledby="team-members">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="team-members" className="text-sm font-extrabold uppercase tracking-widest text-muted">
            Miembros
          </h2>
          <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <EmptyState icon="group" title="Todavía no hay nadie en el equipo" description="Invitá a tu primera persona desde el formulario de abajo." />
        ) : (
          <ul className="space-y-3">
            {members.map((m) => {
              const isYou = m.userId === sessionUser.id;
              return (
                <li key={m.userId}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all font-semibold text-ink">
                          {m.email || "Sin email"}
                          {isYou && <span className="ml-2 text-xs font-bold text-forest-700">Vos</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-faint">Desde {formatDate(m.since)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={m.role === "owner" ? "petrol" : "neutral"}>{m.role === "owner" ? "Dueño" : "Staff"}</Badge>
                        <Badge tone="sage">Activo</Badge>
                      </div>
                    </div>
                    {m.role === "staff" && !isYou && (
                      <div className="mt-3 space-y-3">
                        <StaffPermissionsPanel residenceId={residenceId} memberUserId={m.userId} initial={m.permissions} />
                        <RemoveMemberControl residenceId={residenceId} memberUserId={m.userId} email={m.email} />
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="team-invite">
        <h2 id="team-invite" className="mb-3 text-sm font-extrabold uppercase tracking-widest text-muted">
          Invitar a una persona
        </h2>
        <Card className="p-5">
          {!invitationsAvailable && (
            <p role="status" className="mb-4 rounded-field bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg">
              Las invitaciones por email todavía no están disponibles. Mientras tanto podés ver y gestionar a las personas que ya tienen acceso.
            </p>
          )}
          <InviteForm residenceId={residenceId} disabled={!invitationsAvailable} />
          <p className="mt-3 text-xs text-ink-faint">
            Hasta {MAX_STAFF_PER_RESIDENCE} personas de staff (hoy: {staffCount}
            {pending.filter((i) => i.view === "pending").length > 0 ? ` y ${pending.filter((i) => i.view === "pending").length} invitaciones pendientes` : ""}). La
            invitación vence a los {INVITATION_TTL_DAYS} días y se puede usar una sola vez.
          </p>
        </Card>
      </section>

      {invitationsAvailable && (
        <section className="mt-8" aria-labelledby="team-pending">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="team-pending" className="text-sm font-extrabold uppercase tracking-widest text-muted">
              Invitaciones pendientes
            </h2>
            <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <EmptyState icon="mail" title="Todavía no invitaste a nadie" description="Las invitaciones que mandes van a aparecer acá hasta que se acepten o venzan." />
          ) : (
            <ul className="space-y-3">
              {pending.map((inv) => (
                <li key={inv.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all font-semibold text-ink">{inv.email}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          Enviada el {formatDate(inv.sentAt)} · {inv.view === "expired" ? "venció" : "vence"} el {formatDate(inv.expiresAt)}
                        </p>
                      </div>
                      <Badge tone={inv.view === "expired" ? "danger" : "amber"}>{inv.view === "expired" ? "Vencida" : "Pendiente"}</Badge>
                    </div>
                    <div className="mt-3">
                      <InvitationControls residenceId={residenceId} invitationId={inv.id} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
