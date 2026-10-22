import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { LoginForm } from "@/app/(public)/login/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));
  const { next, reset } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Entrá a tu cuenta de EstuRed.
        </p>
      </div>
      {reset === "ok" && (
        <p
          role="status"
          className="mt-6 rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg"
        >
          Listo, actualizaste tu contraseña. Ingresá con la nueva.
        </p>
      )}
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Todavía no tenés cuenta?{" "}
        <Link
          href="/register"
          className="font-semibold text-forest-700 hover:text-forest-700"
        >
          Crear cuenta
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-faint">
        ¿No podés entrar? Escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
