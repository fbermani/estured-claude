import type { Metadata } from "next";
import { BrandMark } from "@/components/ui/BrandMark";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { LoginForm } from "@/app/(public)/login/LoginForm";

// La query de `next` puede llevar `?invite=<token>` de un enlace personal: no viaja en el Referer.
export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Ingresá a tu cuenta de EstuRed para seguir tus solicitudes y tus residencias.",
  referrer: "no-referrer",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; confirmar?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));
  const { next, reset, confirmar } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <div className="text-center">
        <BrandMark variant="symbol" tile size={52} className="mx-auto mb-4 block" />
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
      {confirmar === "enviado" && (
        <p role="status" className="mt-6 rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
          Creamos tu cuenta. Te mandamos un email para confirmarla: abrí el enlace y entrás directo.
        </p>
      )}
      {confirmar === "error" && (
        <p role="alert" className="mt-6 rounded-field bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg">
          No pudimos confirmar tu email con ese enlace. Ingresá con tu email y contraseña y te mandamos uno nuevo.
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
