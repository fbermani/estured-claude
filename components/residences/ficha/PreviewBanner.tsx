import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { VerificationStatusChip } from "@/components/residences/VerificationStepper";
import { FICHA_PREVIEW_BANNER_REM } from "@/lib/residences/fichaLayout";
import { previewBannerCopy } from "@/lib/residences/previewBanner";

/**
 * Aviso de la vista previa de la ficha (`/residence/[id]/preview`). Dos partes: una barra fija arriba (altura fija, una línea: dice que es
 * una vista previa y vuelve a la configuración) y, debajo, el aviso completo con el estado actual de la residencia. La altura de la barra
 * (`FICHA_PREVIEW_BANNER_REM`) reemplaza a la de la navbar en los sticky de la ficha (`FICHA_PREVIEW_BARS_STYLE`).
 */
export function PreviewBanner({ residenceId, status }: { residenceId: string; status: string }) {
  const { lead, body, progress } = previewBannerCopy(status);
  return (
    <>
      <div
        style={{ height: `${FICHA_PREVIEW_BANNER_REM}rem` }}
        className="sticky top-0 z-40 box-content flex items-center justify-between gap-3 border-b border-line bg-paper px-4 sm:px-6"
      >
        <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-ink">
          <Icon name="visibility" className="shrink-0 text-xl text-forest-700" />
          <span className="truncate">Vista previa</span>
        </p>
        <Button href={`/residence/${residenceId}/profile`} variant="outline" size="sm" aria-label="Volver a la configuración" className="shrink-0">
          <Icon name="arrow_back" className="text-lg" />
          <span className="sm:hidden">Volver</span>
          <span className="hidden sm:inline">Volver a la configuración</span>
        </Button>
      </div>
      <div className="border-b border-line bg-amber-soft-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <p className="min-w-0 text-sm text-ink">
            <strong className="font-bold">{lead}</strong> {body}
          </p>
          {progress && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-soft">
              <VerificationStatusChip progress={progress} />
              <span>{progress.currentLine}</span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
