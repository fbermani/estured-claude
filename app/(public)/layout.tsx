import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getSessionUser } from "@/lib/auth/session";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Con sesión iniciada no tiene sentido ofrecer "Crear cuenta". El enlace de
  // arrepentimiento se mantiene para todos: docs/10 §15.4 lo pide en el footer.
  const user = await getSessionUser();
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer hideSignup={Boolean(user)} />
    </div>
  );
}
