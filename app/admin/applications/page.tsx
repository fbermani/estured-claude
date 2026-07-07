import type { Metadata } from "next";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";

export const metadata: Metadata = { title: "Solicitudes" };

/** Gestión global de solicitudes: requiere application_requests (docs/06 §11), aún no construido. */
export default function AdminApplicationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
        Solicitudes
      </h1>
      <AdminCard className="mt-6 p-8 text-center">
        <p className="text-sm font-semibold" style={{ color: cmd.onSurface }}>
          Todavía no hay solicitudes en el sistema
        </p>
        <p className="mt-1 text-sm" style={{ color: cmd.outline }}>
          El flujo de solicitud de reserva (estudiante → residencia) es el próximo bloque grande a
          construir.
        </p>
      </AdminCard>
    </div>
  );
}
