import type { Metadata } from "next";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { HomeBackdrop } from "@/components/preapertura/HomeBackdrop";
import { FamilyBenefitsPanel } from "@/components/preapertura/FamilyBenefitsPanel";
import { FamilyForm } from "@/components/preapertura/FamilyForm";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSafeUser } from "@/lib/supabase/safe-get-user";

export const metadata: Metadata = { title: "Registro familiar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FamiliarPage() {
  // Con sesión iniciada no hay nada que registrar (el formulario muestra un aviso; ver `FamilyForm`).
  const supabase = await getSupabaseServer();
  const loggedIn = Boolean(supabase && (await getSafeUser(supabase)));
  return (
    <PreaperturaStage preview={<HomeBackdrop />} labelledBy="pre-family-title" size="wide" initialFocus="#pre-email">
      <div className="grid grid-cols-[minmax(0,1fr)] p-2 pb-0 @min-[860px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] @min-[860px]:p-2.5">
        <FamilyBenefitsPanel />
        <FamilyForm loggedIn={loggedIn} />
      </div>
    </PreaperturaStage>
  );
}
