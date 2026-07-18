import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { getOwnerResidenceCards } from "@/lib/residences/ownerDashboard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { AreaHeader } from "@/components/layout/AreaHeader";
import { Footer } from "@/components/layout/Footer";
import { OwnerResidenceGrid } from "@/components/residences/OwnerResidenceGrid";

export const metadata: Metadata = { title: "Panel de residencia" };
export const dynamic = "force-dynamic";

/**
 * Vista multi-residencia en scroll vertical, sin agregado (docs/00
 * §25.3, docs/11 §7.3: "No habrá un dashboard agregado con métricas
 * consolidadas de todas las residencias"). Cada card muestra métricas
 * reales de ESA residencia únicamente — nunca sumadas entre
 * residencias. Con una sola residencia hoy en la mayoría de las
 * cuentas demo, pero la estructura ya soporta hasta 10 (docs/00 §25.1).
 */
export default async function ResidenceDashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/residence/dashboard");

  const admin = getSupabaseAdmin();
  const [validCards, rate] = await Promise.all([
    admin ? getOwnerResidenceCards(admin, sessionUser.id) : Promise.resolve([]),
    admin ? getCurrentExchangeRate() : Promise.resolve(null),
  ]);
  const arsPerUsd = rate?.arsPerUsd ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <AreaHeader areaLabel="Residencias" userEmail={sessionUser.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink">Tus residencias</h1>
            <p className="mt-1 text-ink-soft">Gestioná el perfil y la publicación de cada una.</p>
          </div>
          <div className="flex gap-2">
            {validCards.length > 0 && (
              <Button href="/residence/dashboard/pdf" variant="outline" size="sm">
                <Icon name="download" className="text-base" />
                Reporte PDF
              </Button>
            )}
            <Button href="/register/residence" variant="outline" size="sm">
              + Sumar otra residencia
            </Button>
          </div>
        </div>

        {validCards.length === 0 ? (
          <EmptyState
            title="Todavía no tenés residencias cargadas"
            description="Si acabás de registrarte, puede que falte completar el alta."
          />
        ) : (
          <OwnerResidenceGrid cards={validCards} arsPerUsd={arsPerUsd} />
        )}
      </main>
      <Footer />
    </div>
  );
}
