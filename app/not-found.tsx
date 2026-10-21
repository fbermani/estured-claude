import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ComingSoon } from "@/components/ui/ComingSoon";

/**
 * 404 global con marca (auditoría 2026-10-20, H30). Next solo usa
 * `app/(public)/not-found.tsx` para los `notFound()` que se disparan dentro
 * del grupo público; para URLs que no existen en ningún grupo (`/foo`) caía
 * en el 404 de Next, en inglés y con fondo negro. Este archivo cubre ese caso
 * con la misma navbar y footer del sitio.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <ComingSoon
          title="No encontramos esa página"
          description="Puede que el enlace haya cambiado o que la página ya no exista. Volvé al inicio o explorá las residencias."
        />
      </main>
      <Footer />
    </div>
  );
}
