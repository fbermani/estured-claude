/** Saludo del dashboard del estudiante (propuesta A): degradé suave + ilustración de edificios. Decorativo. */
export function StudentGreeting({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex items-center justify-between gap-3 overflow-hidden rounded-[30px] bg-gradient-to-br from-forest-tint to-amber-soft-100 px-5 py-5 md:px-9 md:py-7">
      <div>
        <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink md:text-4xl">{title}</h1>
        <p className="mt-1.5 max-w-xl text-ink-soft">{subtitle}</p>
      </div>
      <svg viewBox="0 0 220 150" className="h-auto w-24 shrink-0 md:w-[190px]" aria-hidden="true">
        <circle cx="170" cy="36" r="22" fill="var(--color-amber-soft-300)" />
        <rect x="20" y="62" width="62" height="78" rx="8" fill="var(--color-sage-200)" />
        <rect x="74" y="34" width="70" height="106" rx="8" fill="var(--color-forest)" />
        <rect x="136" y="70" width="56" height="70" rx="8" fill="var(--color-orange-light)" />
        <g fill="var(--color-cream)" opacity=".9">
          <rect x="86" y="48" width="14" height="14" rx="3" />
          <rect x="108" y="48" width="14" height="14" rx="3" />
          <rect x="86" y="72" width="14" height="14" rx="3" />
          <rect x="108" y="72" width="14" height="14" rx="3" />
          <rect x="86" y="96" width="14" height="14" rx="3" />
          <rect x="144" y="84" width="12" height="12" rx="3" />
          <rect x="164" y="84" width="12" height="12" rx="3" />
          <rect x="32" y="76" width="12" height="12" rx="3" />
          <rect x="52" y="76" width="12" height="12" rx="3" />
        </g>
        <rect x="108" y="116" width="14" height="24" rx="4" fill="var(--color-forest-ink)" />
        <rect x="8" y="138" width="204" height="4" rx="2" fill="var(--color-forest-ink)" opacity=".25" />
      </svg>
    </header>
  );
}
