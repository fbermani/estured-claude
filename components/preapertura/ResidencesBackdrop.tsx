import { ResidencesLanding } from "@/components/marketing/ResidencesLanding";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/**
 * Fondo de las pantallas de residencias de la preapertura (fundadoras, formulario y éxito): la `/for-residences` REAL completa, con su
 * Navbar y su Footer reales, planes incluidos. Es solo escenografía inerte: va dentro de `BlurredPreview` (`aria-hidden` + `inert`, sin foco
 * ni clics), en flujo normal con scroll del documento. Un solo header y footer: los reales de esta capa.
 */
export function ResidencesBackdrop() {
  return (
    <div className="bg-cream">
      <Navbar />
      <ResidencesLanding schema={false} />
      <Footer />
    </div>
  );
}
