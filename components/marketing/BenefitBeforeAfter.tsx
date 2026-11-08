import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { SwipeStack } from "@/components/ui/SwipeStack";

/**
 * Beneficios para residencias en formato «Hoy → Con EstuRed», cada uno con un fragmento de pantalla de ejemplo
 * (datos ficticios, rotulados). Compacto: una línea por lado. En mobile, mazo con swipe (SwipeStack).
 */

function Pair({ title, hoy, con, dark = false }: { title: string; hoy: string; con: string; dark?: boolean }) {
  const tag = dark ? "bg-white/12 text-white/80" : "bg-sand-100 text-ink-soft";
  const tagCon = dark ? "bg-white text-petrol-800" : "bg-petrol-600 text-white";
  return (
    <div className="grid gap-2">
      <h3 className={`text-[17px] leading-snug ${dark ? "text-white" : "text-ink"}`}>{title}</h3>
      <p className="flex items-baseline gap-2 text-[13.5px]">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tag}`}>Hoy</span>
        <span className={`italic ${dark ? "text-white/70" : "text-ink-faint"}`}>{hoy}</span>
      </p>
      <p className="flex items-baseline gap-2 text-[14px]">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tagCon}`}>Con EstuRed</span>
        <span className={dark ? "text-white" : "text-ink"}>{con}</span>
      </p>
    </div>
  );
}

function Proof({ label, dark = false, children }: { label: string; dark?: boolean; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative grid gap-1.5 rounded-field p-3 text-[12.5px] ${dark ? "bg-white text-ink" : "bg-sand-50 text-ink"}`}
    >
      <span className="justify-self-end text-[10px] font-medium uppercase leading-none tracking-wide text-ink-faint">Ejemplo</span>
      {children}
    </div>
  );
}

const card = "grid content-start gap-3 rounded-card border border-line bg-paper p-4 shadow-card sm:p-5";

export function BenefitBeforeAfter() {
  return (
    <SwipeStack label="Beneficios para residencias" className="grid gap-3 md:grid-cols-12 md:gap-4">
      <article className={`${card} md:col-span-7`}>
        <Pair
          title="Menos consultas repetidas"
          hoy="«Respondo precio y reglas veinte veces.»"
          con="Tu ficha responde lo de siempre."
        />
        <Proof label="Ejemplo: la ficha ya responde precio y reglas; la consulta nueva es específica.">
          <p className="text-ink-soft">Ya responde tu ficha: precio · qué incluye · reglas ✓</p>
          <p className="rounded-field bg-paper px-2.5 py-1.5">
            <span className="text-[11px] text-ink-faint">Consulta nueva · Estudiante A.</span>
            <br />
            «¿Puedo mudarme el 3 de marzo en vez del 1?»
          </p>
        </Proof>
      </article>

      <article className="grid content-start gap-3 rounded-card bg-petrol-900 p-4 text-white shadow-card sm:p-5 md:col-span-5">
        <Pair
          dark
          title="Renovaciones y lista de espera"
          hoy="«Me entero tarde de quién se va.»"
          con="Sabés quién sigue y a quién avisar."
        />
        <Proof dark label="Ejemplo: un residente renueva, otro no, y hay estudiantes en lista de espera, uno que decidió esperar.">
          {[
            ["Residente B.", "Renueva", "sage"],
            ["Residente C.", "No renueva", "amber"],
            ["Estudiante D.", "Avisar", "petrol"],
            ["Estudiante E.", "Decidió esperar", "neutral"],
          ].map(([n, s, t]) => (
            <p key={n} className="flex items-center justify-between gap-2 pr-0 pt-0.5">
              <span>{n}</span>
              <Badge tone={t as "sage" | "amber" | "petrol" | "neutral"}>{s}</Badge>
            </p>
          ))}
          <p className="text-[11px] text-ink-faint">El aviso no reserva la plaza: sujeta a confirmación.</p>
        </Proof>
      </article>

      <article className={`${card} md:col-span-5`}>
        <Pair
          title="Reservas y pagos con registro"
          hoy="«La seña quedó en un chat.»"
          con="Lo acordado y cobrado, por escrito."
        />
        <Proof label="Ejemplo de comprobante ER-0427: seña, pago a la residencia, registrado.">
          <p className="flex items-center justify-between gap-2 pr-12">
            <span>
              Comprobante <b>ER-0427</b>
            </span>
            <Badge tone="sage">Registrado</Badge>
          </p>
          <p className="text-ink-soft">Seña · pago a la residencia · Hab. doble desde 1/3</p>
          <p className="text-ink-soft">Lo ven: vos y el estudiante</p>
        </Proof>
      </article>

      <article className={`${card} md:col-span-7`}>
        <Pair
          title="Afinidad de convivencia antes de aceptar"
          hoy="«Una mala convivencia y se vacía la habitación.»"
          con="Ves hábitos en común con quien ya vive ahí."
        />
        <Proof label="Ejemplo: solicitud de Estudiante F. con tres hábitos en común con quien ya vive en la habitación.">
          <p className="pr-12">
            <b>Estudiante F.</b> · solicitud para Hab. doble · vive ahí: Residente B.
          </p>
          <p className="flex flex-wrap gap-1.5">
            {["Se levanta temprano", "No fuma", "Estudia en casa"].map((c) => (
              <Badge key={c} tone="sage">
                ✓ {c}
              </Badge>
            ))}
            <Badge>Toca la guitarra</Badge>
          </p>
          <p className="text-[11px] text-ink-faint">✓ = en común. La decisión es tuya.</p>
        </Proof>
      </article>
    </SwipeStack>
  );
}
