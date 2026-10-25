import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser, hasAnyRole, roleHome } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadStudentFollowup } from "@/lib/followups/access";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FollowupForm } from "@/app/students/followup/[id]/FollowupForm";

export const metadata: Metadata = { title: "¿Cómo viene tu estadía?" };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Encuesta de seguimiento post-ingreso (DR14, docs/08 §6.17). La ve el estudiante, o su familiar vinculado si es menor. */
export default async function StudentFollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/students/followup/${id}`);
  if (!hasAnyRole(user, ["student", "family_member"])) redirect(roleHome(user));
  if (!UUID_RE.test(id)) notFound();

  const admin = getSupabaseAdmin();
  if (!admin) {
    return <EmptyState icon="sentiment_neutral" title="No disponible en este momento" description="Probá de nuevo en unos minutos." />;
  }
  const loaded = await loadStudentFollowup(admin, user.id, id);
  if (loaded.kind === "unavailable") {
    return <EmptyState icon="schedule" title="Todavía no está disponible" description="Esta encuesta va a estar lista muy pronto." />;
  }
  if (loaded.kind === "not_found") notFound();
  const { view } = loaded;

  const isGuardian = view.role === "guardian";
  const subject = isGuardian ? `la estadía de ${view.studentName ?? "tu familiar"}` : "tu estadía";
  const closed = view.status === "no_response" || view.status === "reviewed" || view.status === "cancelled";

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-ink">{isGuardian ? `¿Cómo viene ${subject}?` : "¿Cómo viene tu estadía?"}</h1>
        {view.residenceName && <p className="text-sm text-ink-soft">{view.residenceName}</p>}
      </header>
      <Card className="space-y-5 p-6">
        {view.alreadyAnswered ? (
          <p role="status" className="text-sm font-bold text-ink">
            ¡Gracias! Ya recibimos tu respuesta.
          </p>
        ) : closed ? (
          <p className="text-sm text-ink-soft">
            Esta encuesta ya no está disponible. Si necesitás ayuda con algo, escribile a Soporte.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              Tu respuesta es privada: la residencia no la ve. Si necesitás ayuda con algo, escribile a Soporte.
            </p>
            <FollowupForm followupId={view.id} />
          </>
        )}
      </Card>
    </div>
  );
}
