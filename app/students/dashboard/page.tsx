import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Tu espacio" };

export default async function StudentDashboardPage() {
  const supabase = await getSupabaseServer();
  let firstName: string | null = null;
  let isMinor = false;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Lectura con RLS: el estudiante solo ve su propio perfil.
      const { data: profile } = await supabase
        .from("student_profiles")
        .select("first_name, is_minor")
        .eq("user_id", user.id)
        .maybeSingle();
      firstName = profile?.first_name ?? null;
      isMinor = profile?.is_minor ?? false;
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-petrol-800">
        {firstName ? `¡Hola, ${firstName}!` : "¡Hola!"}
      </h1>
      <p className="mt-2 text-ink-soft">
        Tu cuenta está lista. Desde acá vas a seguir toda tu búsqueda.
      </p>

      {isMinor && (
        <div className="mt-6 rounded-card border border-amber-soft-300 bg-warning-bg p-5">
          <p className="font-semibold text-warning-fg">
            Sos menor de edad: vas a necesitar un familiar vinculado
          </p>
          <p className="mt-1 text-sm text-warning-fg">
            Para poder enviar solicitudes de reserva, un padre, madre o
            familiar debe vincularse a tu cuenta y aprobar el proceso. La
            vinculación se habilita muy pronto — mientras tanto podés explorar
            y guardar residencias.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col p-6">
          <h2 className="font-bold text-petrol-800">Explorar residencias</h2>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Residencias verificadas en CABA, con precios claros y universidades
            cercanas.
          </p>
          <Button href="/search" size="sm" className="mt-4 self-start">
            Buscar residencia
          </Button>
        </Card>
        <Card className="flex flex-col p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-petrol-800">Completar mi perfil</h2>
            <Badge tone="amber">Muy pronto</Badge>
          </div>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Carrera, hábitos de convivencia, intereses y visibilidad. Un perfil
            completo mejora tus solicitudes.
          </p>
        </Card>
        <Card className="flex flex-col p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-petrol-800">Mis solicitudes</h2>
            <Badge tone="amber">Muy pronto</Badge>
          </div>
          <p className="mt-2 flex-1 text-sm text-ink-soft">
            Acá vas a seguir tus solicitudes de reserva, condiciones y
            comprobantes, todo registrado.
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
