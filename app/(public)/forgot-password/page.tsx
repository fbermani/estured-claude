import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/app/(public)/forgot-password/ForgotPasswordForm";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">¿Olvidaste tu contraseña?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Ingresá el email de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.
        </p>
      </div>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Te acordaste?{" "}
        <Link href="/login" className="font-semibold text-forest-700">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
