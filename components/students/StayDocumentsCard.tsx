import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DocumentUpload } from "@/app/students/profile/DocumentUpload";

export type StayDocumentItem = {
  id: string;
  label: string;
  documentType: "student_identity" | "student_academic_proof" | "student_criminal_record" | "other";
  /** Solo en «Otro»: nombre con el que se guarda el archivo para reconocerlo. */
  requirementLabel: string | null;
  delivered: boolean;
};

/**
 * DR38 — «Documentación de tu estadía»: lo que tu residencia pide, cruzado con lo que ya tenés en tu perfil.
 * Solo se ofrece subir lo que falta; lo ya cargado queda atenuado con ✓. Los documentos son privados: acá nunca hay enlaces a archivos.
 */
export function StayDocumentsCard({ items }: { items: StayDocumentItem[] }) {
  const total = items.length;
  const missing = items.filter((i) => !i.delivered);
  const done = items.filter((i) => i.delivered);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-extrabold uppercase tracking-wider text-muted">Documentación de tu estadía</p>
        <Icon name="folder_shared" className="text-lg text-muted" />
      </div>

      {total === 0 ? (
        <p className="text-sm text-ink-soft">Tu residencia no te pidió documentos para la estadía.</p>
      ) : (
        <>
          <p className="text-sm font-bold text-ink">
            Ya tenés {done.length} de {total} en tu perfil
          </p>
          <div className="mt-2">
            <ProgressBar value={(done.length / total) * 100} label="Documentos ya cargados" className="h-1.5" trackClassName="bg-sand-200" />
          </div>

          {missing.length === 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-forest-700">
              <Icon name="check_circle" className="text-lg" /> Documentación completa
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              <p className="text-xs text-ink-soft">Te falta subir:</p>
              {missing.map((m) => (
                <DocumentUpload
                  key={m.id}
                  documentType={m.documentType}
                  label={m.label}
                  done={false}
                  requirementLabel={m.requirementLabel ?? undefined}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <ul className="mt-3 space-y-1">
              {done.map((d) => (
                <li key={d.id} className="flex items-center gap-1.5 text-xs text-ink-faint">
                  <Icon name="check_circle" className="text-sm text-forest-700/70" />
                  <span>{d.label}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
            Son privados: la residencia solo ve si lo entregaste, no el archivo.
          </p>
        </>
      )}

      <Link href="/students/profile" className="mt-3 inline-block text-sm font-semibold text-forest-700 hover:underline">
        Ver mis documentos →
      </Link>
    </Card>
  );
}
