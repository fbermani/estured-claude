import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { formatDate } from "@/lib/dates/format";
import { listSignupRequests } from "@/lib/residenceSignup/signupRequests";
import { SIGNUP_STATUSES, SIGNUP_STATUS_LABEL, canGenerateInvite, canTransition, isSignupStatus, type SignupStatus } from "@/lib/residenceSignup/rules";
import { changeStatusAction, confirmEmailAction, saveDetailsAction } from "@/app/admin/solicitudes-alta/actions";
import { ActionForm } from "@/app/admin/solicitudes-alta/ActionForm";
import { InviteGenerator } from "@/app/admin/solicitudes-alta/InviteGenerator";

export const metadata: Metadata = { title: "Solicitudes de alta" };
export const dynamic = "force-dynamic";

const TONE: Record<SignupStatus, "amber" | "primary" | "violet" | "emerald" | "neutral"> = {
  received: "amber",
  in_contact: "primary",
  visit_scheduled: "violet",
  account_delivered: "emerald",
  discarded: "neutral",
};

/** `datetime-local` en hora de Argentina (UTC-3) a partir de un ISO. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);
}

/** Cola de solicitudes de alta de residencias (DR22 D/E). Solo admin; el contacto y el envío del enlace son manuales. */
export default async function AdminSignupRequestsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin();
  const { estado } = await searchParams;
  const filter = estado === "all" ? "all" : isSignupStatus(estado) ? estado : "active";
  const admin = getSupabaseAdmin();
  if (!admin) return <p className="p-6 text-sm">No disponible en este momento.</p>;
  const result = await listSignupRequests(admin, filter);

  const header = (
    <div>
      <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>Solicitudes de alta</h1>
      <p className="text-xs" style={{ color: cmd.outline }}>
        Residencias que pidieron sumarse. Ordenadas por antigüedad. Contactalas, coordiná la visita y, después, generá el enlace para que creen su cuenta.
      </p>
    </div>
  );

  if (!result.ok) {
    return (
      <div className="space-y-3 p-6">
        {header}
        <p className="text-sm" style={{ color: cmd.outline }}>
          {result.missingSchema ? "Todavía no está disponible: falta aplicar la migración 0066." : "No pudimos cargar las solicitudes. Probá de nuevo."}
        </p>
      </div>
    );
  }

  const filters: { key: string; label: string }[] = [
    { key: "active", label: "Activas" },
    ...SIGNUP_STATUSES.map((s) => ({ key: s, label: SIGNUP_STATUS_LABEL[s] })),
    { key: "all", label: "Todas" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      {header}
      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "active" ? "/admin/solicitudes-alta" : `/admin/solicitudes-alta?estado=${f.key}`}
            aria-current={f.key === filter ? "page" : undefined}
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={f.key === filter ? { backgroundColor: cmd.onSurface, color: "#fff" } : { border: `1.5px solid ${cmd.border}`, color: cmd.onSurface }}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {result.rows.length === 0 && <p className="text-sm" style={{ color: cmd.outline }}>No hay solicitudes en este filtro.</p>}
      <ul className="space-y-3">
        {result.rows.map((r) => {
          const nextStates = SIGNUP_STATUSES.filter((s) => canTransition(r.status, s));
          const closed = r.status === "account_delivered" || r.status === "discarded";
          const hasPending = !!r.invite_expires_at && !r.invite_used_at;
          return (
            <li key={r.id}>
              <AdminCard className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: cmd.onSurface }}>{r.residence_name}</span>
                  <AdminBadge tone={TONE[r.status]}>{SIGNUP_STATUS_LABEL[r.status]}</AdminBadge>
                  <span className="text-xs" style={{ color: cmd.outline }}>{r.neighborhood} · recibida el {formatDate(r.created_at)}</span>
                </div>
                <p className="text-xs" style={{ color: cmd.onSurface }}>
                  {r.contact_name} · {r.email} · {r.phone}
                  {r.instagram_or_web ? ` · ${r.instagram_or_web}` : ""}
                  {r.approx_beds ? ` · ~${r.approx_beds} camas` : ""}
                </p>
                <p className="text-xs" style={{ color: cmd.outline }}>
                  Datos cargados por la propia residencia (no verificados).
                  {r.contacted_at ? ` Primer contacto: ${formatDate(r.contacted_at)}.` : ""}
                  {r.visit_at ? ` Visita: ${new Date(r.visit_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.` : ""}
                  {hasPending && r.invite_expires_at ? ` Invitación vigente hasta ${formatDate(r.invite_expires_at)}.` : ""}
                  {r.invite_used_at ? ` Invitación usada el ${formatDate(r.invite_used_at)}.` : ""}
                </p>

                {nextStates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {nextStates.map((s) => (
                      <ActionForm key={s} action={changeStatusAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" name="to" value={s} className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold" style={s === "discarded" ? { border: `1.5px solid ${cmd.border}`, color: cmd.onSurface } : { backgroundColor: cmd.onSurface, color: "#fff" }}>
                          {s === "discarded" ? "Descartar" : `Pasar a «${SIGNUP_STATUS_LABEL[s]}»`}
                        </button>
                      </ActionForm>
                    ))}
                  </div>
                )}

                {!closed && (
                  <div className="text-xs" style={{ color: cmd.outline }}>
                    {r.email_confirmed_at ? (
                      <span>Email confirmado con la residencia el {formatDate(r.email_confirmed_at)}.</span>
                    ) : (
                      <ActionForm action={confirmEmailAction} okMessage="Email confirmado.">
                        <input type="hidden" name="id" value={r.id} />
                        <span>El email no está verificado: confirmalo con la residencia antes de generar la invitación. </span>
                        <button type="submit" className="cursor-pointer rounded-full px-3 py-1 text-xs font-bold" style={{ border: `1.5px solid ${cmd.border}`, color: cmd.onSurface }}>
                          Confirmé el email con la residencia
                        </button>
                      </ActionForm>
                    )}
                  </div>
                )}

                {canGenerateInvite(r.status, r.invite_used_at, r.email_confirmed_at) && (
                  <InviteGenerator id={r.id} contactName={r.contact_name} residenceName={r.residence_name} phone={r.phone} hasPending={hasPending} />
                )}

                {!closed && (
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold" style={{ color: cmd.onSurface }}>Notas, visita y ficha borrador</summary>
                    <ActionForm action={saveDetailsAction} className="mt-2 space-y-2" okMessage="Guardado.">
                      <input type="hidden" name="id" value={r.id} />
                      <label className="block text-xs" style={{ color: cmd.outline }}>
                        Notas internas
                        <textarea name="admin_notes" defaultValue={r.admin_notes ?? ""} maxLength={4000} rows={3} className="mt-1 w-full rounded border p-2 text-xs" style={{ borderColor: cmd.border }} />
                      </label>
                      <label className="block text-xs" style={{ color: cmd.outline }}>
                        Email de contacto (si lo cambiás, hay que volver a confirmarlo)
                        <input type="email" name="email" required defaultValue={r.email} maxLength={254} className="mt-1 block w-full rounded border p-1.5 text-xs" style={{ borderColor: cmd.border }} />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <label className="block text-xs" style={{ color: cmd.outline }}>
                          Visita (hora de Argentina)
                          <input type="datetime-local" name="visit_at" defaultValue={toLocalInput(r.visit_at)} className="mt-1 block rounded border p-1.5 text-xs" style={{ borderColor: cmd.border }} />
                        </label>
                        <label className="block min-w-64 flex-1 text-xs" style={{ color: cmd.outline }}>
                          ID de la ficha borrador (opcional, interna)
                          <input type="text" name="residence_id" defaultValue={r.residence_id ?? ""} className="mt-1 block w-full rounded border p-1.5 text-xs" style={{ borderColor: cmd.border }} />
                        </label>
                      </div>
                      <button type="submit" className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold" style={{ border: `1.5px solid ${cmd.border}`, color: cmd.onSurface }}>Guardar</button>
                    </ActionForm>
                  </details>
                )}
                {r.admin_notes && closed && <p className="text-xs" style={{ color: cmd.outline }}>Notas: {r.admin_notes}</p>}
              </AdminCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
