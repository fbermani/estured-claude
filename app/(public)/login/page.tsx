import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <ComingSoon
      title="Iniciar sesión"
      description="Las cuentas de estudiantes, familias y residencias se habilitan en la próxima etapa, junto con Supabase Auth. Mientras tanto podés sumarte a la lista de espera."
    />
  );
}
