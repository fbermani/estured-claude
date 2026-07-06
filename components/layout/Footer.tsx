import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-sand-200 bg-petrol-900 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl font-bold">EstuRed</p>
          <p className="mt-3 max-w-sm text-sm text-petrol-200">
            La convivencia también se elige. Residencias estudiantiles
            verificadas en CABA, con solicitudes claras y comprobantes
            respaldados.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-petrol-300">
            Explorar
          </p>
          <ul className="mt-3 space-y-2 text-sm text-petrol-100">
            <li>
              <Link href="/search" className="hover:text-white">
                Buscar residencias
              </Link>
            </li>
            <li>
              <Link href="/for-students" className="hover:text-white">
                Para estudiantes y familias
              </Link>
            </li>
            <li>
              <Link href="/for-residences" className="hover:text-white">
                Para residencias
              </Link>
            </li>
            <li>
              <Link href="/waitlist" className="hover:text-white">
                Lista de espera
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-petrol-300">
            Confianza
          </p>
          <ul className="mt-3 space-y-2 text-sm text-petrol-100">
            <li>Residencias verificadas presencialmente</li>
            <li>Solicitudes registradas y auditables</li>
            <li>Comprobante de Reserva Confirmada</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-petrol-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-petrol-300">
            EstuRed actúa como plataforma intermediaria de búsqueda, solicitud,
            registro y comprobante. No presta directamente el alojamiento. Los
            precios en ARS son referenciales al dólar blue del día.
          </p>
          <p className="shrink-0 text-xs text-petrol-300">
            Hecho con <span aria-hidden>♥</span> en Buenos Aires
          </p>
        </div>
      </div>
    </footer>
  );
}
