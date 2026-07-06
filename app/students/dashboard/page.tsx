import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Dashboard estudiante" };

/**
 * Placeholder del área estudiante/familiar (docs/11 §7.2).
 * El área completa (favoritos, solicitudes, comprobantes, perfil,
 * documentos, familiar vinculado) se construye con auth en Fase 1+.
 * El familiar vinculado comparte esta área — no existe un dashboard
 * familiar separado (decisión de docs/08 §3.2).
 */
export default function StudentDashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ComingSoon
          title="Tu espacio de estudiante"
          description="Acá vas a ver tus favoritos, solicitudes, reservas y comprobantes. Se habilita junto con las cuentas en la próxima etapa."
        />
      </main>
      <Footer />
    </div>
  );
}
