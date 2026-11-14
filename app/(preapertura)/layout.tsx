import { notFound } from "next/navigation";
import { SkipLink } from "@/components/ui/SkipLink";
import { isPreaperturaOn } from "@/lib/preapertura/flag";
import "./preapertura.css";

/**
 * Layout de la preapertura (DR42.1): solo existe con `PREAPERTURA=on`; apagado, estas rutas dan 404 y la app queda como siempre.
 * Cada pantalla es un popup fijo sobre la landing real (blureada, en flujo normal) y acá van el enlace «Saltar al contenido» y el
 * `<main id="contenido">`. Los componentes de header/footer de preapertura (`components/preapertura/PreaperturaHeader|Footer`)
 * también reemplazan a la Navbar/Footer públicos en `(public)`.
 *
 * SOLO EN DESARROLLO se suma el navegador flotante «Pantallas (dev)». El `import()` está dentro de la rama `NODE_ENV === "development"`:
 * en el build de producción esa condición es falsa en tiempo de compilación y el componente ni se incluye.
 */
export default async function PreaperturaLayout({ children }: { children: React.ReactNode }) {
  if (!isPreaperturaOn()) notFound();
  const showDevNav = process.env.NODE_ENV === "development" || (process.env.NEXT_PUBLIC_STAGING === "on" && process.env.VERCEL_ENV !== "production");
  const DevScreenNav = showDevNav ? (await import("@/components/dev/DevScreenNav")).DevScreenNav : null;
  return (
    <>
      <SkipLink />
      <main id="contenido">{children}</main>
      {DevScreenNav && <DevScreenNav />}
    </>
  );
}
