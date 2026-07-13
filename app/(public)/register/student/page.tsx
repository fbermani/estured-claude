import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { RegisterStudentForm } from "@/app/(public)/register/student/RegisterStudentForm";

export const metadata: Metadata = { title: "Crear cuenta de estudiante" };

export default async function RegisterStudentPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">
          Crear cuenta de estudiante
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tu apellido, fecha de nacimiento y universidad son privados: nunca se
          muestran públicamente.
        </p>
      </div>
      <div className="mt-8">
        <RegisterStudentForm />
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
