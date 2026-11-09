import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getSessionUser } from "@/lib/auth/session";
import { SkipLink } from "@/components/ui/SkipLink";
import { PreaperturaHeader } from "@/components/preapertura/PreaperturaHeader";
import { PreaperturaFooter } from "@/components/preapertura/PreaperturaFooter";
import { isPreaperturaOn } from "@/lib/preapertura/flag";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Con sesión iniciada no tiene sentido ofrecer "Crear cuenta". El enlace de
  // arrepentimiento se mantiene para todos: docs/10 §15.4 lo pide en el footer.
  const user = await getSessionUser();
  // DR42.2: con PREAPERTURA=on, header y footer de preapertura (sin «Crear cuenta», buscador ni Guías). Apagado, todo igual que antes.
  const preapertura = isPreaperturaOn();
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      {preapertura ? <PreaperturaHeader /> : <Navbar />}
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      {preapertura ? <PreaperturaFooter /> : <Footer hideSignup={Boolean(user)} />}
    </div>
  );
}
