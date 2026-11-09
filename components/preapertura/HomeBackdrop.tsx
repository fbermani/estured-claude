import { HomeLanding } from "@/components/marketing/HomeLanding";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/**
 * Lo que se ve detrás del popup de preapertura: la home REAL de EstuRed completa, con su Navbar y su Footer reales (los del sitio abierto,
 * con todos sus enlaces y «Crear cuenta»), el contenido de `HomeLanding` en el medio y datos reales (catálogo, tipo de cambio). Es solo
 * escenografía: va dentro de `BlurredPreview` (`aria-hidden` + `inert`, fuera del árbol accesible y sin foco ni clics), así que nadie
 * puede navegar ahí. En flujo normal con scroll del documento: el Navbar (sticky, z-40) queda debajo de la capa de blur (z-50) y del popup
 * (z-60), y no hay segundo header porque las rutas del popup viven en `(preapertura)`, que no dibuja header ni footer propios.
 */
export async function HomeBackdrop() {
  return (
    <div className="bg-cream">
      <Navbar />
      <HomeLanding schema={false} />
      <Footer />
    </div>
  );
}
