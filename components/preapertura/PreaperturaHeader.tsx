import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";

/**
 * Header de la preapertura (DR42.2): reemplaza a la Navbar pública solo con `PREAPERTURA=on`. Sin «Crear cuenta», sin buscador y
 * sin «Guías» (no se enlaza en preapertura, DR42.3). `sticky={false}` lo deja estático dentro de la landing blureada.
 */
export function PreaperturaHeader({ sticky = true }: { sticky?: boolean }) {
  return (
    <header className={`${sticky ? "sticky top-0 z-40" : ""} border-b border-line bg-cream/90 backdrop-blur-md`}>
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="EstuRed, inicio">
          <BrandMark size={34} />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/for-residences"
            className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-bold whitespace-nowrap text-ink-soft transition-colors hover:bg-cream-2 hover:text-forest-700"
          >
            Para residencias
          </Link>
          <Button href="/login" variant="ghost" size="sm">
            Ingresar
          </Button>
        </div>
      </nav>
    </header>
  );
}
