import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { AreaHeader } from "@/components/layout/AreaHeader";
import { Footer } from "@/components/layout/Footer";
import { AddResidenceForm } from "@/app/residence/settings/new/AddResidenceForm";
import { SkipLink } from "@/components/ui/SkipLink";

export const metadata: Metadata = { title: "Sumar otra residencia" };
export const dynamic = "force-dynamic";

/**
 * Alta de una residencia adicional para un owner ya logueado (docs/11 §7.3
 * `/residence/settings/new`, solo owner; H22). El staff vuelve al panel.
 */
export default async function NewResidencePage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/residence/settings/new");
  if (!hasAnyRole(sessionUser, ["residence_owner"])) redirect("/residence/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <AreaHeader areaLabel="Residencias" userEmail={sessionUser.email} />
      <main id="contenido" tabIndex={-1} className="focus:outline-none mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/residence/dashboard" className="text-sm font-semibold text-forest-700 hover:underline">
          ← Volver a tus residencias
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-ink">Sumar otra residencia</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Se crea como borrador dentro de tu misma cuenta. Después completás el perfil completo: servicios, fotos,
          habitaciones y tarifas, y la enviás a verificación.
        </p>
        <div className="mt-8">
          <AddResidenceForm />
        </div>
      </main>
      <Footer staffView />
    </div>
  );
}
