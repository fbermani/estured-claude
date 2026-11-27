import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";

const NAV = ["Inicio", "Buscar residencias", "Mis solicitudes", "Comunidad", "Mi perfil"] as const;
const PHOTO_TONES = ["bg-cream-2", "bg-mint", "bg-peach"] as const;

/** Barra gris que hace de texto (la vista previa nunca muestra datos de residencias ni de personas). */
function Line({ w }: { w: string }) {
  return <i className="block h-2.5 rounded-full bg-cream-2" style={{ width: w }} />;
}

/**
 * Fondo de «Mi lugar»: el panel del estudiante tal como se va a ver al abrir, blureado detrás del popup (SPEC «Patrón común»). Es solo
 * una maqueta con barras grises, no un compromiso de oferta. Va dentro de `BlurredPreview` (`aria-hidden` + `inert`).
 */
export function DashboardPreview({ firstName }: { firstName?: string | null }) {
  return (
    <div className="grid min-h-full grid-cols-[210px_minmax(0,1fr)] bg-cream max-sm:grid-cols-[minmax(0,1fr)]">
      <div className="grid content-start gap-1 surface-forest bg-forest-ink p-4 text-white max-sm:hidden">
        <span className="px-2 py-1.5">
          <BrandMark size={30} />
        </span>
        {NAV.map((item, i) => (
          <span key={item} className={`rounded-field px-3 py-2.5 text-sm font-semibold ${i === 0 ? "bg-white/15" : "text-white/80"}`}>
            {item}
          </span>
        ))}
      </div>
      <div className="grid content-start gap-5 p-6 sm:p-8">
        <p className="font-display text-3xl font-bold text-ink">{firstName ? `Hola, ${firstName}` : "Hola"}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {["Tu búsqueda", "Solicitudes", "Tu llegada"].map((t) => (
            <div key={t} className="grid gap-2.5 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card">
              <b className="font-display text-base">{t}</b>
              <Line w="70%" />
              <Line w="45%" />
            </div>
          ))}
        </div>
        <p className="font-display text-xl font-bold text-ink">Residencias para vos</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PHOTO_TONES.map((tone, i) => (
            <div key={i} className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
              <div className={`h-28 ${tone}`} />
              <div className="grid gap-2 p-3.5">
                <Line w="70%" />
                <Line w="40%" />
              </div>
            </div>
          ))}
        </div>
        <p className="font-display text-xl font-bold text-ink">Tu comunidad</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-card border-[1.5px] border-line bg-paper p-4 shadow-card">
              <span className="grid size-10 place-items-center rounded-full bg-forest-tint text-forest-700">
                <Icon name="person" />
              </span>
              <div className="grid flex-1 gap-2">
                <Line w="60%" />
                <Line w="35%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
