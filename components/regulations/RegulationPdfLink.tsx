/** Enlace de descarga del reglamento cuando la versión vigente es un PDF (DR59 a). El enlace firmado se genera en el servidor al hacer clic. */
export function RegulationPdfLink({ slug, className = "" }: { slug: string; className?: string }) {
  return (
    <a
      href={`/residencias/${slug}/reglamento`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-field border border-line-2 bg-white px-3 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-tint ${className}`}
    >
      Descargar reglamento (PDF)
    </a>
  );
}
