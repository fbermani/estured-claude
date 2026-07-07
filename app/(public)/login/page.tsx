import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { LoginForm } from "@/app/(public)/login/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-petrol-800">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Entrá a tu cuenta de EstuRed.
        </p>
      </div>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Todavía no tenés cuenta?{" "}
        <Link
          href="/register"
          className="font-semibold text-petrol-600 hover:text-petrol-700"
        >
          Crear cuenta
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-faint">
        La recuperación de contraseña se habilita próximamente. Si no podés
        entrar, escribinos.
      </p>
    </div>
  );
}
