import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { RegisterResidenceForm } from "@/app/(public)/register/residence/RegisterResidenceForm";

export const metadata: Metadata = { title: "Sumar mi residencia" };

export default async function RegisterResidencePage() {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">
          Solicitá sumar tu residencia
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Dejanos los datos principales. El equipo de EstuRed te contacta para
          conocer tu residencia; la cuenta se entrega después.
        </p>
      </div>
      <div className="mt-8">
        <RegisterResidenceForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="font-semibold text-forest-700 hover:text-forest-700"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
