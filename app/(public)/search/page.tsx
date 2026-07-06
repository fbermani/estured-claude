import type { Metadata } from "next";
import { SearchCatalog } from "@/app/(public)/search/SearchCatalog";

export const metadata: Metadata = {
  title: "Buscar residencias en CABA",
  description:
    "Explorá residencias estudiantiles verificadas en CABA. Filtrá por barrio, tipo de habitación y disponibilidad.",
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-petrol-800 sm:text-4xl">
          Residencias verificadas en CABA
        </h1>
        <p className="mt-2 text-ink-soft">
          Todas las residencias del catálogo fueron verificadas presencialmente.
          La disponibilidad es informativa y toda reserva está sujeta a
          confirmación.
        </p>
      </div>
      <SearchCatalog />
    </div>
  );
}
