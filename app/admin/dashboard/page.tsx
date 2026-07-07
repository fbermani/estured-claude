import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Admin EstuRed" };

export const dynamic = "force-dynamic";

/**
 * Dashboard admin mínimo: métricas básicas reales. Los módulos de
 * gestión (docs/09) se construyen por fases junto a cada dominio.
 */
export default async function AdminDashboardPage() {
  const admin = getSupabaseAdmin();

  let stats: { label: string; value: number | string }[] = [];
  if (admin) {
    const [users, students, waitlist, audits] = await Promise.all([
      admin.from("users").select("*", { count: "exact", head: true }),
      admin.from("student_profiles").select("*", { count: "exact", head: true }),
      admin.from("waitlist_signups").select("*", { count: "exact", head: true }),
      admin.from("audit_logs").select("*", { count: "exact", head: true }),
    ]);
    stats = [
      { label: "Usuarios registrados", value: users.count ?? 0 },
      { label: "Perfiles de estudiante", value: students.count ?? 0 },
      { label: "Lista de espera (leads)", value: waitlist.count ?? 0 },
      { label: "Eventos de auditoría", value: audits.count ?? 0 },
    ];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-petrol-800">Panel de administración</h1>
      <p className="mt-2 text-ink-soft">
        Estado general de la plataforma. Los módulos de gestión se habilitan
        por fases.
      </p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-6">
            <p className="text-3xl font-extrabold text-petrol-700">{s.value}</p>
            <p className="mt-1 text-sm text-ink-soft">{s.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
