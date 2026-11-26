import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { devAutoAccountsEnabled } from "@/lib/preapertura/devAccounts";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { ResidencesBackdrop } from "@/components/preapertura/ResidencesBackdrop";
import { RegisterResidenceForm } from "@/app/(public)/register/residence/RegisterResidenceForm";

export const metadata: Metadata = { title: "Sumar mi residencia", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Formulario de 5 datos de la solicitud de alta (DR46.4) en el lenguaje de la preapertura: popup sobre `/for-residences` blureada.
 * Con `PREAPERTURA=on`, `next.config.ts` reescribe `/register/residence` acá (la URL no cambia). Misma acción de servidor que la
 * versión de siempre (`requestResidenceSignup`); quien ya tiene sesión va a su inicio, igual que antes.
 */
export default async function SolicitudResidenciaPage({ searchParams }: { searchParams: Promise<{ dev?: string | string[] }> }) {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));
  // Solo desarrollo: `?dev=cupo|lleno|cerrado` abre directo la pantalla de éxito (la usa el navegador «Pantallas (dev)»). En producción se ignora.
  const devParam = (await searchParams).dev;
  const dev = Array.isArray(devParam) ? devParam[0] : devParam;
  const devSuccess = devAutoAccountsEnabled() && (dev === "cupo" || dev === "lleno" || dev === "cerrado") ? dev : undefined;
  return (
    <PreaperturaStage
      preview={<ResidencesBackdrop />}
      labelledBy="pre-resi-title"
      size="mid"
      initialFocus="#rr-residence_name"
    >
      <RegisterResidenceForm key={devSuccess ?? "form"} variant="preapertura" devSuccess={devSuccess} />
    </PreaperturaStage>
  );
}
