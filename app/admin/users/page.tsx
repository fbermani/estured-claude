import type { Metadata } from "next";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";

export const metadata: Metadata = { title: "Usuarios" };

/** Gestión global de usuarios: diferida a un próximo ciclo (ver design-references 3ra parte). */
export default function AdminUsersPage() {
  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Usuarios
      </h1>
      <AdminCard className="mt-6 p-8 text-center">
        <p className="text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Gestión global de usuarios — próximamente
        </p>
        <p className="mt-1 text-sm" style={{ color: cmd.outline }}>
          Búsqueda, bloqueo y edición de roles. Mientras tanto, los usuarios se administran vía
          Supabase o <code>scripts/create-admin.mjs</code>.
        </p>
      </AdminCard>
    </div>
  );
}
