import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { DashboardPreview } from "@/components/preapertura/DashboardPreview";
import { MiLugarContent } from "@/components/preapertura/MiLugarContent";
import { devAutoAccountsEnabled, isDevAutoEmail } from "@/lib/preapertura/devAccounts";
import { getStudentPosition } from "@/lib/preapertura/counts";
import { getCommunityRail } from "@/lib/preapertura/communityRailData";
import { loadMiLugar, type MiLugarData } from "@/lib/preapertura/miLugar";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";

export const metadata: Metadata = { title: "Mi lugar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const EMPTY: MiLugarData = { role: null, firstName: null, createdAt: null, profilePercent: null, profileComplete: false, registrationNumber: null, invitation: null };

/**
 * «Mi lugar» final (Fase 3, SPEC pantalla 5): celebración con el número real, panel blureado «se activa cuando abramos», 5 pasos y
 * carrusel de comunidad. Variantes: perfil incompleto, familiar (invitación esperando o vinculados). Todo sale de la sesión
 * (`getSafeUser`): sin sesión vuelve al registro; nunca se lee nada por un id que mande el cliente.
 */
export default async function MiLugarPage() {
  const supabase = await getSupabaseServer();
  const user = supabase ? await getSafeUser(supabase) : null;
  if (!user) redirect("/preregistro");

  const admin = getSupabaseAdmin();
  const data = admin ? await loadMiLugar(admin, user.id) : EMPTY;
  const [position, rail] = await Promise.all([
    data.role === "student" && data.createdAt ? getStudentPosition(data.createdAt) : Promise.resolve(null),
    getCommunityRail(),
  ]);

  return (
    <PreaperturaStage
      preview={<DashboardPreview firstName={data.firstName} />}
      previewLabel="Tu panel · se activa cuando abramos"
      labelledBy="pre-lugar-title"
      describedBy="pre-lugar-text"
      size="lugar"
    >
      <MiLugarContent data={data} position={position} rail={rail} devAccount={devAutoAccountsEnabled() && isDevAutoEmail(user.email)} />
    </PreaperturaStage>
  );
}
