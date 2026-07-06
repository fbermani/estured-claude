import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Dashboard residencia" };

/**
 * Placeholder del área residencia (docs/11 §7.3), con soporte
 * multi-residencia (`/residence/[residence_id]/...`) a construir en
 * fases posteriores junto con auth y permisos.
 */
export default function ResidenceDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ComingSoon
          title="Panel de tu residencia"
          description="Acá vas a gestionar tu perfil, disponibilidad, solicitudes, lista de espera y renovaciones. Se habilita junto con las cuentas en la próxima etapa."
        />
      </main>
      <Footer />
    </div>
  );
}
