import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Crear cuenta" };

const options = [
  {
    href: "/register/student",
    title: "Soy estudiante",
    description:
      "Busco residencia en CABA. Quiero comparar opciones verificadas y enviar solicitudes con respaldo.",
    available: true,
  },
  {
    href: "/register/family",
    title: "Soy padre, madre o familiar",
    description:
      "Quiero acompañar la búsqueda de un estudiante: proponer opciones, seguir el proceso y ver comprobantes.",
    available: false,
  },
  {
    href: "/register/residence",
    title: "Soy residencia",
    description:
      "Administro una residencia estudiantil y quiero sumarla a la red verificada de EstuRed.",
    available: true,
  },
];

export default async function RegisterPage() {
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-petrol-800">Crear cuenta</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Elegí cómo vas a usar EstuRed. Después vas a poder sumar otros
          vínculos (por ejemplo, un familiar).
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-4">
        {options.map((o) => (
          <Link key={o.href} href={o.href} className="group">
            <Card interactive className="flex items-center gap-4 p-6">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-petrol-800">{o.title}</h2>
                  {!o.available && <Badge tone="amber">Muy pronto</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{o.description}</p>
              </div>
              <span className="text-petrol-500 transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="font-semibold text-petrol-600 hover:text-petrol-700"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
