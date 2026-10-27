import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";

const steps = [
  "Abrís un caso desde tu reserva y nos contás qué pasó.",
  "Revisamos lo que pasó (fotos, mensajes, documentos) y hablamos con la residencia.",
  "Te acompañamos para encontrar otra opción.",
];

/** Bloque «Si algo no coincide con lo publicado» (INVENTARIO_COPY §7.4, DR13). Sin la palabra «garantía». */
export function WhenSomethingDiffers() {
  return (
    <section id="si-algo-no-coincide" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeader
        eyebrow="Soporte"
        title="Si algo no coincide con lo publicado"
        description="Si al llegar encontrás algo muy distinto de lo que la residencia publicó o de lo que aceptaste (otra habitación, otro precio, una dirección que no es), escribinos a Soporte."
      />
      <Reveal>
        <Card className="p-7">
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-tint text-xs font-bold text-forest-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-ink-faint">
            Aplica a diferencias importantes y comprobables, no a expectativas. Lo que pagaste a la residencia se resuelve con ella, según sus condiciones. Abrir un caso no suspende la reserva de forma automática.
          </p>
        </Card>
      </Reveal>
    </section>
  );
}
