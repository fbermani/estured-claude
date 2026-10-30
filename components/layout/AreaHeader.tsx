import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { signOut } from "@/app/(public)/login/actions";
import { toneClass, type RoleTone } from "@/lib/ui/tone";
import { NotificationBell } from "@/components/layout/NotificationBell";

/**
 * Header de las áreas autenticadas (/students, /residence, /admin).
 * Server component: el logout es una server action, sin JS de cliente.
 */
export function AreaHeader({
  areaLabel,
  userEmail,
  tone = "student",
}: {
  areaLabel: string;
  userEmail: string;
  /** Tono del rol (kit logueado): pill de área y barra inferior. Por defecto, estudiante (verde, como antes). */
  tone?: RoleTone;
}) {
  return (
    <header className={`${toneClass(tone)} sticky top-0 z-40 border-b border-sand-200 bg-surface/90 backdrop-blur after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-(--tone) after:opacity-90`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label="EstuRed, inicio">
            <BrandMark size={34} hideTextOnMobile />
          </Link>
          <span className="rounded-full bg-(--tone-tint) px-3 py-1 text-xs font-semibold text-(--tone-700)">
            {areaLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="hidden text-sm text-ink-soft sm:inline">{userEmail}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-sand-300 px-4 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-(--tone) hover:text-(--tone-700)"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
