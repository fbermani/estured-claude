import Link from "next/link";
import { signOut } from "@/app/(public)/login/actions";
import { NotificationBell } from "@/components/layout/NotificationBell";

/**
 * Header de las áreas autenticadas (/students, /residence, /admin).
 * Server component: el logout es una server action, sin JS de cliente.
 */
export function AreaHeader({
  areaLabel,
  userEmail,
}: {
  areaLabel: string;
  userEmail: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" aria-label="EstuRed, inicio">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest font-display text-lg font-extrabold text-white">
              E
            </span>
            <span className="hidden font-display text-xl font-extrabold tracking-tight text-ink sm:inline">
              EstuRed
            </span>
          </Link>
          <span className="rounded-full bg-forest-tint px-3 py-1 text-xs font-semibold text-forest-700">
            {areaLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="hidden text-sm text-ink-soft sm:inline">{userEmail}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-sand-300 px-4 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-forest hover:text-forest-700"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
