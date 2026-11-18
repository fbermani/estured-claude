import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/ui/SkipLink";
import { PreaperturaHeader } from "@/components/preapertura/PreaperturaHeader";
import { PreaperturaFooter } from "@/components/preapertura/PreaperturaFooter";
import { isPreaperturaLocked } from "@/lib/preapertura/flag";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Este layout NO lee la sesión: así las páginas públicas estáticas (guías, términos, privacidad…) se sirven desde caché.
  // «Crear cuenta» del footer se oculta por CSS si hay sesión (`data-session-hint`, ver Footer).
  // DR42.2: con la preapertura cerrada (PREAPERTURA=on en producción), header y footer de preapertura (sin «Crear cuenta», buscador ni
  // Guías). En desarrollo y con el flag apagado, header y footer reales.
  const preapertura = isPreaperturaLocked();
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      {preapertura ? <PreaperturaHeader /> : <Navbar />}
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      {preapertura ? <PreaperturaFooter /> : <Footer />}
    </div>
  );
}
