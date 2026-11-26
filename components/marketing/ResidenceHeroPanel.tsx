import { Icon } from "@/components/ui/Icon";

const SIDE = [
  { icon: "dashboard", label: "Panel", on: true },
  { icon: "inbox", label: "Solicitudes", count: 1 },
  { icon: "bed", label: "Disponibilidad" },
  { icon: "sync_alt", label: "Renovaciones" },
  { icon: "groups", label: "Residentes" },
  { icon: "hourglass_top", label: "Lista de espera" },
  { icon: "forum", label: "Preguntas", count: 2 },
  { icon: "gavel", label: "Reglamento" },
];

const TODO = [
  { icon: "inbox", label: "1 solicitud nueva", cta: "Revisar solicitudes" },
  { icon: "sync_alt", label: "Renovaciones: 2 esperando tu respuesta", cta: "Ver renovaciones" },
  { icon: "swap_horiz", label: "1 residente busca cambiar", cta: "Ver residentes" },
];

const mini = "whitespace-nowrap rounded-full border-[1.5px] border-line-2 bg-white px-2.5 py-1 text-xs font-bold text-ink";

/**
 * Hero de /for-residences (propuesta b): réplica en HTML/CSS del panel real de la residencia («Para hacer hoy»,
 * Renovaciones, Residentes, menú «Preguntas» con contador) más la tarjeta «Quién quiere reservar» con hábitos de
 * convivencia. Datos de ejemplo y nombres ficticios, rotulados. Decorativo y estático: una sola imagen para
 * lectores de pantalla. Server Component, sin movimiento.
 */
export function ResidenceHeroPanel() {
  return (
    <div
      role="img"
      aria-label="Vista de ejemplo del panel de una residencia: solicitudes nuevas, renovaciones, residentes, lista de espera y preguntas; y la tarjeta Quién quiere reservar con los hábitos de convivencia. Datos de ejemplo."
      className="relative mx-auto w-full max-w-xl lg:max-w-none"
    >
      <div className="overflow-hidden rounded-[18px] border border-white/10 bg-cream text-ink shadow-[0_18px_50px_rgb(0_0_0/.35)]">
        <div className="flex items-center gap-2 border-b border-line bg-cream-2 px-3.5 py-2.5">
          <span className="truncate text-xs font-semibold text-ink-soft">Panel de la residencia</span>
          <span className="ml-auto inline-flex items-center rounded-full bg-butter px-[9px] py-[3px] text-xs font-bold text-butter-fg">
            Datos de ejemplo
          </span>
        </div>

        <div className="grid min-h-0 grid-cols-1 sm:min-h-[360px] sm:grid-cols-[138px_minmax(0,1fr)]">
          <nav className="hidden content-start gap-0.5 border-r border-line bg-paper px-2 py-3 text-xs font-semibold text-ink-soft sm:grid">
            {SIDE.map((s) => (
              <span
                key={s.label}
                className={`flex items-center gap-[7px] rounded-[9px] px-2 py-1.5 ${s.on ? "bg-forest-tint text-forest-700" : ""}`}
              >
                <Icon name={s.icon} className="text-base" />
                {s.label}
                {s.count ? (
                  <span className="ml-auto rounded-full bg-orange px-1.5 text-xs font-bold leading-4 text-white">{s.count}</span>
                ) : null}
              </span>
            ))}
          </nav>

          <div className="grid content-start gap-3 px-4 pb-3.5 pt-3.5 sm:pb-[92px]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold leading-[1.1] tracking-tight">Residencia Norte</p>
                <p className="flex items-center gap-0.5 text-xs text-ink-soft">
                  <Icon name="location_on" className="text-sm" />
                  Palermo, CABA
                </p>
              </div>
              <span className={mini}>Editar perfil</span>
            </div>

            <div className="rounded-2xl border-[1.5px] border-orange bg-gradient-to-b from-orange-tint to-white to-80% px-3.5 py-3">
              <p className="mb-1.5 font-display text-[14.5px] font-bold">Para hacer hoy</p>
              <ul className="m-0 list-none p-0">
                {TODO.map((t) => (
                  <li
                    key={t.label}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-orange/25 py-1.5 text-xs font-semibold first:border-t-0 first:pt-0"
                  >
                    <span className="flex items-center gap-[7px]">
                      <Icon name={t.icon} className="text-[17px] text-orange-700" />
                      {t.label}
                    </span>
                    <span className={mini}>{t.cta}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1 rounded-[14px] border border-line bg-white p-2.5 text-xs text-ink-soft shadow-[0_1px_2px_rgb(29_39_34/.05)]">
                <div className="flex items-start justify-between gap-1">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-lilac text-lilac-fg">
                    <Icon name="sync_alt" className="text-base" />
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-orange-tint px-[7px] py-px text-xs font-bold text-orange-700">2 por revisar</span>
                </div>
                <p className="mt-0.5 font-display text-[13px] font-bold text-ink">Renovaciones</p>
                <span>2 esperando tu respuesta</span>
              </div>
              <div className="grid gap-1 rounded-[14px] border border-line bg-white p-2.5 text-xs text-ink-soft shadow-[0_1px_2px_rgb(29_39_34/.05)]">
                <div className="flex items-start justify-between gap-1">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sky text-sky-fg">
                    <Icon name="groups" className="text-base" />
                  </span>
                </div>
                <p className="mt-0.5 font-display text-[13px] font-bold text-ink">Residentes</p>
                <span>
                  <b className="text-ink">28</b> cargados, <b className="text-ink">4</b> en lista de espera
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mx-2.5 -mt-3.5 w-auto rounded-[18px] border border-line bg-white px-3.5 py-3 text-ink shadow-float lg:absolute lg:-bottom-[34px] lg:-left-10 lg:mx-0 lg:mt-0 lg:w-[236px] lg:-rotate-[1.5deg]">
        <div className="mb-2 flex items-center gap-[9px]">
          <span className="flex size-[34px] items-center justify-center rounded-full bg-forest-tint text-[13px] font-bold text-forest-700">M</span>
          <div>
            <span className="text-xs font-bold text-ink-faint">Quién quiere reservar</span>
            <br />
            <b className="text-[13.5px]">María José R.</b>
          </div>
        </div>
        <span className="text-xs font-bold text-ink-faint">Hábitos de convivencia</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {["Ordenado", "Estudio en silencio"].map((c) => (
            <span key={c} className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
