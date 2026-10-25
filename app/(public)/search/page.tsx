import type { Metadata } from "next";
import { SearchCatalog } from "@/app/(public)/search/SearchCatalog";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { getCatalogResidencesWithTotal } from "@/lib/residences/catalog";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSessionUser } from "@/lib/auth/session";
import { getStudentAgeAt, parseIngresoParam } from "@/lib/residences/studentAge";
import { todayIso } from "@/lib/residences/age";

export const metadata: Metadata = {
  title: "Buscar residencias en CABA",
  description:
    "Explorá residencias estudiantiles verificadas en CABA. Filtrá por barrio, tipo de habitación y disponibilidad.",
};
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ ingreso?: string }> }) {
  // DR14: filtro por edad del estudiante autenticado, a la fecha de ingreso del filtro (`?ingreso=AAAA-MM-DD`) o a hoy.
  // Visitante o perfil sin fecha de nacimiento: no se excluye ninguna residencia.
  const { ingreso } = await searchParams;
  const sessionUser = await getSessionUser();
  const studentAge = sessionUser?.roles.includes("student")
    ? await getStudentAgeAt(sessionUser.id, parseIngresoParam(ingreso) ?? todayIso())
    : null;
  const [rate, { residences, total }] = await Promise.all([
    getCurrentExchangeRate(),
    getCatalogResidencesWithTotal({ studentAge }),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-5 max-w-2xl sm:mb-8">
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
          Encontrá tu próximo hogar en Buenos Aires
        </h1>
        <p className="mt-2 text-ink-soft">
          Todas las residencias del catálogo fueron verificadas presencialmente.
          La disponibilidad es informativa y toda reserva está sujeta a
          confirmación.
        </p>
      </div>
      {residences.length === 0 && total > 0 ? (
        <EmptyState
          icon="apartment"
          title="No hay residencias para tu edad con estos filtros"
          description="Cada residencia define la edad de sus residentes. Probá con otra fecha de ingreso o consultá más adelante: el catálogo se va ampliando."
        />
      ) : residences.length === 0 ? (
        <EmptyState
          icon="apartment"
          title="Todavía no hay residencias verificadas"
          description="Estamos verificando las primeras residencias de la red. Volvé a pasar pronto."
        />
      ) : (
        <SearchCatalog residences={residences} arsPerUsd={rate.arsPerUsd} />
      )}
    </div>
  );
}
