import type { Metadata } from "next";
import { WaitlistForm } from "@/app/(public)/waitlist/WaitlistForm";

export const metadata: Metadata = {
  title: "Lista de espera",
  description:
    "Sumate a la lista de espera de EstuRed y sé de los primeros en buscar, comparar y reservar residencias verificadas en CABA.",
};

export default function WaitlistPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="text-center">
        <p className="mb-4 inline-flex rounded-full bg-amber-soft-100 px-3 py-1 text-sm font-semibold text-amber-soft-700">
          EstuRed está llegando a CABA
        </p>
        <h1 className="text-3xl font-bold text-petrol-800 sm:text-4xl">
          Sumate a la lista de espera
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-ink-soft">
          Estamos verificando las primeras residencias. Dejanos tus datos y te
          avisamos apenas puedas empezar a buscar — o coordinar la verificación
          de tu residencia.
        </p>
      </div>
      <div className="mt-10">
        <WaitlistForm />
      </div>
    </div>
  );
}
