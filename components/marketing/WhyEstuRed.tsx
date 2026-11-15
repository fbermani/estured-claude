import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ReceiptMiniature } from "@/components/marketing/ReceiptMiniature";

/**
 * Home · «Por qué EstuRed» (DR22): fusiona «Por qué» y «La diferencia».
 * Tabla «Con EstuRed vs. por fuera»
 * y miniatura del comprobante de reserva.
 */
const ROWS = [
  { what: "La residencia", withUs: "Verificada en persona por EstuRed", outside: "La chequeás por tu cuenta" },
  { what: "Precio y costos", withUs: "Publicados, sin costos ocultos", outside: "Los consultás uno por uno" },
  { what: "Acuerdos", withUs: "Registrados en tu cuenta", outside: "Quedan en chats sueltos" },
  { what: "Reserva confirmada", withUs: "Comprobante con código verificable", outside: "Depende de cada residencia" },
  { what: "Si algo no coincide", withUs: "Abrís un caso de Soporte", outside: "Lo resolvés directo con la residencia" },
];

export function WhyEstuRed() {
  return (
    <section className="border-y border-sand-200 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        <SectionHeader
          eyebrow="Por qué EstuRed"
          title="Hacelo por EstuRed y queda todo por escrito"
          align="left"
          description="Instagram y los referidos sirven para descubrir. Para reservar, conviene que quede registrado."
        />

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          {/* Desktop: tabla semántica */}
          <table className="hidden w-full overflow-hidden rounded-card border border-sand-200 text-left md:table">
            <caption className="sr-only">Con EstuRed vs. por fuera</caption>
            <thead>
              <tr className="text-sm">
                <th scope="col" className="bg-sand-50 px-4 py-3 font-semibold text-ink-faint">
                  Qué cambia
                </th>
                <th scope="col" className="bg-forest-tint px-4 py-3 font-bold text-forest-700">
                  Con EstuRed
                </th>
                <th scope="col" className="bg-sand-50 px-4 py-3 font-semibold text-ink-soft">
                  Por fuera
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.what} className="border-t border-sand-200 text-[15px]">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {r.what}
                  </th>
                  <td className="bg-forest-tint/40 px-4 py-3 font-medium text-ink">
                    <span className="flex items-start gap-2">
                      <Icon name="check" className="mt-0.5 text-lg text-forest" />
                      {r.withUs}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    <span className="flex items-start gap-2">
                      <Icon name="remove" className="mt-0.5 text-lg text-ink-faint" />
                      {r.outside}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: filas apiladas, rótulo arriba y dos celdas lado a lado */}
          <ul className="space-y-2.5 md:hidden" aria-label="Con EstuRed vs. por fuera">
            {ROWS.map((r) => (
              <li key={r.what} className="rounded-card border border-sand-200 p-3">
                <p className="text-xs font-bold text-ink-faint">{r.what}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-2 text-[13px] leading-snug">
                  <p className="flex items-start gap-1.5 rounded-lg bg-forest-tint/60 p-2 font-medium text-ink">
                    <Icon name="check" className="text-base text-forest" />
                    <span>
                      <span className="sr-only">Con EstuRed: </span>
                      {r.withUs}
                    </span>
                  </p>
                  <p className="flex items-start gap-1.5 p-2 text-ink-soft">
                    <Icon name="remove" className="text-base text-ink-faint" />
                    <span>
                      <span className="sr-only">Por fuera: </span>
                      {r.outside}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Miniatura del comprobante: en mobile queda debajo de la tabla */}
          <ReceiptMiniature />
        </div>
      </div>
    </section>
  );
}
