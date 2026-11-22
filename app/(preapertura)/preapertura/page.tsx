import type { Metadata } from "next";
import { PreaperturaStage } from "@/components/preapertura/PreaperturaStage";
import { HomeBackdrop } from "@/components/preapertura/HomeBackdrop";
import { EntryContent } from "@/components/preapertura/EntryContent";
import { FounderCta } from "@/components/preapertura/FounderCta";
import { getPreaperturaEntryData } from "@/lib/preapertura/counts";

// Con `PREAPERTURA=on`, `/` y `/for-students` se reescriben acá (next.config.ts). Los contadores son reales y se refrescan cada minuto.
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "EstuRed: acceso anticipado a residencias estudiantiles en Buenos Aires" },
  description:
    "Sumate gratis y enterate primero qué residencias estudiantiles de Buenos Aires pasan nuestra visita presencial. Estamos visitándolas una por una.",
};

export default async function PreaperturaEntryPage() {
  const { counter, founders, closure } = await getPreaperturaEntryData();
  return (
    <PreaperturaStage
      preview={<HomeBackdrop />}
      labelledBy="pre-h1"
      describedBy="pre-sub"
      size="entry"
      initialFocus='a[href="/preregistro"]'
      aside={<FounderCta state={founders} closure={closure} variant="float" />}
    >
      <EntryContent counter={counter} founders={founders} closure={closure} />
    </PreaperturaStage>
  );
}
