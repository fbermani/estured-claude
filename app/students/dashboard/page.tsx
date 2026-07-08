import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FamilyLinkActions } from "@/app/students/FamilyLinkActions";

export const metadata: Metadata = { title: "Tu espacio" };
export const dynamic = "force-dynamic";

interface StudentLinkRow {
  id: string;
  status: string;
  family_members: { first_name: string; last_name: string; relationship_type: string } | null;
}
interface FamilyLinkRow {
  id: string;
  status: string;
  student_profiles: { first_name: string; last_initial: string } | null;
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor/a",
  familiar: "Familiar",
};

export default async function StudentDashboardPage() {
  const sessionUser = await getSessionUser();
  const supabase = await getSupabaseServer();
  const isFamilyMember = sessionUser?.roles.includes("family_member") ?? false;

  if (isFamilyMember) {
    let links: FamilyLinkRow[] = [];
    if (supabase) {
      const { data } = await supabase
        .from("family_links")
        .select("id, status, student_profiles(first_name, last_initial)")
        .order("created_at", { ascending: false });
      links = (data as unknown as FamilyLinkRow[]) ?? [];
    }

    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold text-petrol-800">Tu espacio de familiar</h1>
        <p className="mt-2 text-ink-soft">
          Acompañás a estos estudiantes en EstuRed. Solo ellos pueden decidir sobre sus
          solicitudes.
        </p>

        <div className="mt-8 space-y-4">
          {links.length === 0 ? (
            <Card className="p-6 text-sm text-ink-soft">
              Todavía no tenés vínculos registrados.
            </Card>
          ) : (
            links.map((l) => (
              <Card key={l.id} className="flex items-center justify-between p-6">
                <div>
                  <p className="font-bold text-petrol-800">
                    {l.student_profiles?.first_name} {l.student_profiles?.last_initial}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {l.status === "pending_student_approval"
                      ? "Esperando que apruebe la vinculación"
                      : l.status === "active"
                        ? "Vínculo activo"
                        : "Vínculo no activo"}
                  </p>
                </div>
                <Badge tone={l.status === "active" ? "sage" : "amber"}>
                  {l.status === "pending_student_approval"
                    ? "Pendiente"
                    : l.status === "active"
                      ? "Activo"
                      : "Cerrado"}
                </Badge>
              </Card>
            ))
          )}
        </div>

        <Card className="mt-8 flex flex-col p-6">
          <h2 className="font-bold text-petrol-800">Explorar residencias</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Podés sugerirle opciones al estudiante que acompañás.
          </p>
          <Button href="/search" size="sm" className="mt-4 self-start">
            Buscar residencia
          </Button>
        </Card>
      </div>
    );
  }

  // Vista de estudiante (default).
  let firstName: string | null = null;
  let isMinor = false;
  let studentLinks: StudentLinkRow[] = [];

  if (supabase && sessionUser) {
    const { data: profile } = await supabase
      .from("student_profiles")
      .select("first_name, is_minor")
      .eq("user_id", sessionUser.id)
      .maybeSingle();
    firstName = profile?.first_name ?? null;
    isMinor = profile?.is_minor ?? false;

    const { data } = await supabase
      .from("family_links")
      .select("id, status, family_members(first_name, last_name, relationship_type)")
      .order("created_at", { ascending: false });
    studentLinks = (data as unknown as StudentLinkRow[]) ?? [];
  }

  const pendingLinks = studentLinks.filter((l) => l.status === "pending_student_approval");
  const activeLink = studentLinks.find((l) => l.status === "active");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-petrol-800">
        {firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}
      </h1>
      <p className="mt-2 text-ink-soft">
        Tu cuenta está lista. Desde acá vas a seguir toda tu búsqueda.
      </p>

      {pendingLinks.map((link) => (
        <div
          key={link.id}
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-petrol-200 bg-petrol-50 p-5"
        >
          <div>
            <p className="font-semibold text-petrol-800">
              {RELATIONSHIP_LABEL[link.family_members?.relationship_type ?? "familiar"]}{" "}
              {link.family_members?.first_name} {link.family_members?.last_name} quiere
              vincularse a tu cuenta
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Va a poder ver tu búsqueda, sugerir residencias y ayudarte con pagos y
              documentación. Vos seguís decidiendo todo.
            </p>
          </div>
          <FamilyLinkActions linkId={link.id} />
        </div>
      ))}

      {activeLink && (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
          <Badge tone="sage">Familiar vinculado</Badge>
          {RELATIONSHIP_LABEL[activeLink.family_members?.relationship_type ?? "familiar"]}{" "}
          {activeLink.family_members?.first_name} {activeLink.family_members?.last_name}
        </p>
      )}

      {isMinor && !activeLink && (
        <div className="mt-6 rounded-card border border-amber-soft-300 bg-warning-bg p-5">
          <p className="font-semibold text-warning-fg">
            Sos menor de edad: vas a necesitar un familiar vinculado
          </p>
          <p className="mt-1 text-sm text-warning-fg">
            Para poder enviar solicitudes de reserva, un padre, madre o familiar debe crear su
            cuenta en{" "}
            <Link href="/register/family" className="underline">
              /register/family
            </Link>{" "}
            y vos aprobar la vinculación acá. Mientras tanto podés explorar y guardar
            residencias.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-petrol-800">Residencias reales</h2>
            <Badge tone="sage">Solicitá de verdad</Badge>
          </div>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Catálogo de residencias verificadas por EstuRed. Podés enviar una solicitud de
            reserva real.
          </p>
          <Button href="/residencias" size="sm" className="mt-4 self-start">
            Ver residencias
          </Button>
        </Card>
        <Card className="flex flex-col p-6">
          <h2 className="font-bold text-petrol-800">Explorar catálogo de demostración</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Ejemplos editoriales de cómo se ve una residencia en EstuRed. No podés solicitar
            desde acá todavía.
          </p>
          <Button href="/search" size="sm" variant="outline" className="mt-4 self-start">
            Ver catálogo de ejemplo
          </Button>
        </Card>
        <Card className="flex flex-col p-6">
          <h2 className="font-bold text-petrol-800">Mis solicitudes</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Seguí tus solicitudes de reserva y su estado.
          </p>
          <Button href="/students/applications" size="sm" className="mt-4 self-start">
            Ver mis solicitudes
          </Button>
        </Card>
        <Card className="flex flex-col p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-petrol-800">Completar mi perfil</h2>
            <Badge tone="amber">Muy pronto</Badge>
          </div>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Carrera, hábitos de convivencia, intereses y visibilidad. Un perfil completo mejora
            tus solicitudes.
          </p>
        </Card>
      </div>

      <p className="mt-8 text-xs text-ink-faint">
        ¿Dudas o problemas con tu cuenta?{" "}
        <Link href="/waitlist" className="text-petrol-600 hover:underline">
          Escribinos
        </Link>
        .
      </p>
    </div>
  );
}
