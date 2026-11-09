import type { Metadata } from "next";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { ResidencesBackdrop } from "@/components/preapertura/ResidencesBackdrop";
import { FoundersContent } from "@/components/preapertura/FoundersContent";
import { getFounderClosure, getFounderInputs, getStudentCount } from "@/lib/preapertura/counts";
import { founderState, studentCounter } from "@/lib/preapertura/rules";

// Cupo y contador reales; se refrescan cada minuto. El cierre se evalúa en cada regeneración (`FOUNDERS_CLOSE_AT`).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Residencias fundadoras",
  description: "Sumá tu residencia a EstuRed antes de abrir: gratis, con perfil verificado, insignia de fundadora y menos mensajes repetidos.",
};

/**
 * Pantalla de fundadoras de la preapertura (SPEC pantalla 6, DR46). El CTA «Quiero ser fundadora» de la entrada llega acá; la pantalla
 * de `/for-residences` no se reescribe (DR42). Un popup sobre `/for-residences` blureada, con el cupo real de 10 y, solo si hay fecha
 * de cierre configurada, la cuenta regresiva. «Quiero que me contacten» lleva al formulario de 5 datos (`/register/residence`).
 */
export default async function FundadorasPage() {
  const [inputs, count] = await Promise.all([getFounderInputs(), getStudentCount()]);
  return (
    <PreaperturaStage
      preview={<ResidencesBackdrop />}
      previewLabel="Así se va a ver EstuRed para residencias"
      labelledBy="pre-fund-title"
      describedBy="pre-fund-text"
      size="mid"
      initialFocus='a[href="/register/residence"]'
    >
      <FoundersContent state={founderState(inputs)} closure={getFounderClosure()} counter={studentCounter(count)} />
    </PreaperturaStage>
  );
}
