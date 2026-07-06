import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <ComingSoon
      title="Crear cuenta"
      description="El registro de estudiantes, familias y residencias se habilita en la próxima etapa. Sumate a la lista de espera y te avisamos apenas esté disponible."
    />
  );
}
