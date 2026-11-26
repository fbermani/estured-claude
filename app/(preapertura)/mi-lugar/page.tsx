import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { DashboardPreview } from "@/components/preapertura/DashboardPreview";
import { MiLugarContent } from "@/components/preapertura/MiLugarContent";
import { devAutoAccountsEnabled, isDevAutoEmail } from "@/lib/preapertura/devAccounts";
import { loadMiLugar, type MiLugarData } from "@/lib/preapertura/miLugar";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";

export const metadata: Metadata = { title: "Mi lugar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const EMPTY: MiLugarData = { role: null, firstName: null, createdAt: null, profilePercent: null, profileComplete: false, registrationNumber: null, invitation: null };

/**
 * «Mi lugar» (DR67): registro listo con el número guardado, el perfil como siguiente paso e Instagram. Variantes: perfil incompleto o
 * completo y familiar (invitación esperando, vencida o vinculados). Todo sale de la sesión (`getSafeUser`): sin sesión vuelve al
 * registro; nunca se lee nada por un id que mande el cliente.
 */
export default async function MiLugarPage() {
  const supabase = await getSupabaseServer();
  const user = supabase ? await getSafeUser(supabase) : null;
  if (!user) redirect("/preregistro");

  const admin = getSupabaseAdmin();
  const data = admin ? await loadMiLugar(admin, user.id) : EMPTY;

  return (
    <PreaperturaStage
      preview={<DashboardPreview firstName={data.firstName} />}
      previewLabel="Tu panel · se activa cuando abramos"
      labelledBy="pre-lugar-title"
      size="entry"
      fullOnMobile
    >
      <MiLugarContent data={data} devAccount={devAutoAccountsEnabled() && isDevAutoEmail(user.email)} />
    </PreaperturaStage>
  );
}
