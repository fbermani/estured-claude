import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <ComingSoon
      title="No encontramos esa página"
      description="Puede que el enlace haya cambiado o que la residencia ya no esté publicada. Volvé al inicio o explorá el catálogo."
    />
  );
}
