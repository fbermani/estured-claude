import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon } from "@/components/ui/Icon";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

export function Footer({ hideSignup = false }: { hideSignup?: boolean } = {}) {
  return (
    <footer className="border-t border-line bg-forest-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <BrandMark size={36} tone="dark" />
          <span className="sr-only">EstuRed</span>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            La convivencia también se elige. Residencias estudiantiles
            verificadas en CABA, con solicitudes registradas y comprobantes
            verificables.
          </p>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-white/60">
            Explorar
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <Link
                href="/search"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Buscar residencias
              </Link>
            </li>
            <li>
              <Link
                href="/for-students"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Para estudiantes y familias
              </Link>
            </li>
            <li>
              <Link
                href="/for-residences"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Para residencias
              </Link>
            </li>
            <li>
              <Link
                href="/guias"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Guías
              </Link>
            </li>
            {!hideSignup && (
            <li>
              <Link
                href="/register"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Crear cuenta
              </Link>
            </li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-white/60">
            Ayuda
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <Link
                href="/students/support"
                className="inline-flex items-center gap-1.5 rounded-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Icon name="support_agent" className="text-lg text-amber-soft-300" />
                Soporte
              </Link>
            </li>
            <li>
              <Link
                href="/for-students#preguntas-frecuentes"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Preguntas frecuentes
              </Link>
            </li>
            <li>
              <Link
                href="/#el-proceso"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Cómo funciona
              </Link>
            </li>
            <li className="pt-2 text-xs text-white/60">
              ¿Tenés una reserva y algo no coincide? Abrí un caso desde tu panel.
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-white/60">
            Confianza
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>Residencias verificadas presencialmente</li>
            <li>Solicitudes registradas en la plataforma</li>
            <li>Comprobante de Reserva Confirmada</li>
            <li>
              <Link href="/for-students#que-pagas" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Qué pagás y a quién
              </Link>
            </li>
            <li className="pt-2">
              Contacto:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-white/60">
            EstuRed actúa como plataforma intermediaria de búsqueda, solicitud,
            registro y comprobante. No presta directamente el alojamiento. Los
            precios en ARS son referenciales al dólar blue del día.{" "}
            <Link href="/students/revocation" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Botón de arrepentimiento
            </Link>
            {" · "}
            <Link href="/verify" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Verificar un comprobante
            </Link>
            {" · "}
            <Link href="/terms" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Términos y condiciones
            </Link>
            {" · "}
            <Link href="/privacy" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Política de privacidad
            </Link>
            .
          </p>
          <p className="shrink-0 text-xs text-white/60">
            Hecho con <span aria-hidden>♥</span> en Buenos Aires
          </p>
        </div>
      </div>
    </footer>
  );
}
