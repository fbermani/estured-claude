import { notFound } from "next/navigation";
import { SkipLink } from "@/components/ui/SkipLink";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import "./preapertura.css";

/**
 * Layout de la preapertura (DR42.1): solo existe con `PREAPERTURA=on`; apagado, estas rutas dan 404 y la app queda como siempre.
 * Cada pantalla es un escenario de pantalla completa (landing blureada + popup) que lleva su propio header y footer dentro de la
 * vista previa; acá van el enlace «Saltar al contenido» y el `<main id="contenido">`. Los componentes de header/footer de
 * preapertura (`components/preapertura/PreaperturaHeader|Footer`) también reemplazan a la Navbar/Footer públicos en `(public)`.
 */
export default function PreaperturaLayout({ children }: { children: React.ReactNode }) {
  if (!isPreaperturaOn()) notFound();
  return (
    <>
      <SkipLink />
      <main id="contenido">{children}</main>
    </>
  );
}
