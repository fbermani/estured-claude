import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { ResidencesPreview } from "@/components/preapertura/ResidencesPreview";
import { RegisterResidenceForm } from "@/app/(public)/register/residence/RegisterResidenceForm";

export const metadata: Metadata = { title: "Sumar mi residencia", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Formulario de 5 datos de la solicitud de alta (DR46.4) en el lenguaje de la preapertura: popup sobre `/for-residences` blureada.
 * Con `PREAPERTURA=on`, `next.config.ts` reescribe `/register/residence` acá (la URL no cambia). Misma acción de servidor que la
 * versión de siempre (`requestResidenceSignup`); quien ya tiene sesión va a su inicio, igual que antes.
 */
export default async function SolicitudResidenciaPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));
  return (
    <PreaperturaStage
      preview={<ResidencesPreview />}
      previewLabel="Así se va a ver EstuRed para residencias"
      labelledBy="pre-resi-title"
      size="mid"
      initialFocus="#rr-residence_name"
    >
      <RegisterResidenceForm variant="preapertura" />
    </PreaperturaStage>
  );
}
