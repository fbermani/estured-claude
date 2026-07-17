"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOut } from "@/app/(public)/login/actions";

/**
 * Sidebar de navegación de una residencia puntual — a semejanza
 * estructural de `estured_residence_admin_dashboard` (menú lateral fijo
 * con Dashboard/Solicitudes/Habitaciones/Residentes/Renovaciones). Vive
 * en `app/residence/[residence_id]/layout.tsx`, no en el layout raíz de
 * `/residence`, porque necesita saber a qué residencia pertenecen los
 * links — el selector multi-residencia (`/residence/dashboard`) no
 * tiene una residencia activa todavía.
 */
export function ResidenceSidebar({ residenceId, userEmail }: { residenceId: string; userEmail: string }) {
  const pathname = usePathname();
  const base = `/residence/${residenceId}`;

  const NAV: { href: string; label: string; icon: string; exact?: boolean }[] = [
    { href: base, label: "Panel", icon: "dashboard", exact: true },
    { href: `${base}/applications`, label: "Solicitudes", icon: "inbox" },
    { href: `${base}/rooms`, label: "Habitaciones", icon: "meeting_room" },
    { href: `${base}/availability`, label: "Disponibilidad", icon: "bed" },
    { href: `${base}/renewals`, label: "Renovaciones", icon: "sync_alt" },
    { href: `${base}/residents`, label: "Residentes", icon: "groups" },
    { href: `${base}/waitlist`, label: "Lista de espera", icon: "hourglass_top" },
    { href: `${base}/support`, label: "Soporte", icon: "support_agent" },
  ];

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-line bg-paper">
      <div>
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/residence/dashboard" className="flex items-center gap-2" aria-label="Tus residencias">
            <span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-forest font-display text-lg font-extrabold text-white">
              E
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink">EstuRed</span>
          </Link>
          <NotificationBell />
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "bg-forest-tint text-forest-700" : "text-ink-soft hover:bg-cream-2"
                }`}
              >
                <Icon name={item.icon} className="text-xl" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/residence/dashboard"
          className="mx-3 mt-4 flex items-center gap-2 rounded-field border border-line-2 px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-cream-2"
        >
          <Icon name="apartment" className="text-base" /> Todas mis residencias
        </Link>
      </div>

      <div className="border-t border-line p-4">
        <p className="truncate px-1 text-xs text-ink-faint">{userEmail}</p>
        <Link href={`${base}/profile`} className="mt-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-2">
          <Icon name="edit" className="text-lg" /> Editar perfil
        </Link>
        <form action={signOut}>
          <button type="submit" className="mt-1 flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-cream-2">
            <Icon name="logout" className="text-lg" /> Salir
          </button>
        </form>
      </div>
    </aside>
  );
}
