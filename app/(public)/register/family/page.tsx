import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { RegisterFamilyForm } from "@/app/(public)/register/family/RegisterFamilyForm";

export const metadata: Metadata = { title: "Cuenta de familiar" };

export default async function RegisterFamilyPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-petrol-800">
          Acompañá la búsqueda de tu hijo/a
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Creá tu cuenta y solicitá vincularte. El estudiante tiene que aprobar el vínculo antes
          de que puedas ver su búsqueda.
        </p>
      </div>
      <div className="mt-8">
        <RegisterFamilyForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-petrol-600 hover:text-petrol-700">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
