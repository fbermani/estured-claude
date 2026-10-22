"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOut } from "@/app/(public)/login/actions";
import { useSidebarCollapse } from "@/components/layout/useSidebarCollapse";

/**
 * Sidebar de navegación de una residencia puntual — a semejanza
 * estructural de `estured_residence_admin_dashboard` (menú lateral fijo
 * con Dashboard/Solicitudes/Habitaciones/Residentes/Renovaciones). Vive
 * en `app/residence/[residence_id]/layout.tsx`, no en el layout raíz de
 * `/residence`, porque necesita saber a qué residencia pertenecen los
 * links — el selector multi-residencia (`/residence/dashboard`) no
 * tiene una residencia activa todavía.
 *
 * Colapsable en desktop (preferencia persistida en localStorage) y
 * drawer superpuesto en mobile — mismo mecanismo que `AdminSidebar` y
 * `StudentSidebar` vía `useSidebarCollapse`.
 */
export function ResidenceSidebar({ residenceId, userEmail }: { residenceId: string; userEmail: string }) {
  const pathname = usePathname();
  const base = `/residence/${residenceId}`;
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapse();

  const NAV: { href: string; label: string; icon: string; exact?: boolean }[] = [
    { href: base, label: "Panel", icon: "dashboard", exact: true },
    { href: `${base}/applications`, label: "Solicitudes", icon: "inbox" },
    { href: `${base}/rooms`, label: "Habitaciones", icon: "meeting_room" },
    { href: `${base}/availability`, label: "Disponibilidad", icon: "bed" },
    { href: `${base}/renewals`, label: "Renovaciones", icon: "sync_alt" },
    { href: `${base}/residents`, label: "Residentes", icon: "groups" },
    { href: `${base}/waitlist`, label: "Lista de espera", icon: "hourglass_top" },
    { href: `${base}/faq`, label: "Preguntas", icon: "forum" },
    { href: `${base}/plan`, label: "Tu plan", icon: "workspace_premium" },
    { href: `${base}/support`, label: "Soporte", icon: "support_agent" },
  ];

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-field text-ink-soft"
        >
          <Icon name="menu" className="text-xl" />
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-forest font-display text-sm font-extrabold text-white">
            E
          </span>
          <span className="font-display text-base font-extrabold tracking-tight text-ink">EstuRed</span>
        </span>
        <NotificationBell />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-forest-ink/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col justify-between border-r border-line bg-paper transition-transform duration-200 md:relative md:translate-x-0 md:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-64 md:w-[76px]" : "w-64"}`}
      >
        <div className="min-w-0">
          <div className={`flex items-center gap-2 px-5 py-5 ${collapsed ? "md:justify-center md:px-2" : "justify-between"}`}>
            <Link
              href="/residence/dashboard"
              className={`flex items-center gap-2 ${collapsed ? "md:hidden" : ""}`}
              aria-label="Tus residencias"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-forest font-display text-lg font-extrabold text-white">
                E
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">EstuRed</span>
            </Link>
            <Link
              href="/residence/dashboard"
              aria-label="Tus residencias"
              className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-forest font-display text-lg font-extrabold text-white ${collapsed ? "md:flex" : "md:hidden"}`}
            >
              E
            </Link>
            <div className={collapsed ? "md:hidden" : ""}>
              <NotificationBell />
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="rounded-field p-1 text-ink-soft md:hidden"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>

          <nav className="mt-2 flex flex-col gap-1 px-3">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                    active ? "bg-forest-tint text-forest-700" : "text-ink-soft hover:bg-cream-2"
                  } ${collapsed ? "md:justify-center" : ""}`}
                >
                  <Icon name={item.icon} className="shrink-0 text-xl" />
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            href="/residence/dashboard"
            title="Todas mis residencias"
            aria-label="Todas mis residencias"
            className={`mx-3 mt-4 flex items-center gap-2 rounded-field border border-line-2 px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${collapsed ? "md:justify-center" : ""}`}
          >
            <Icon name="apartment" className="shrink-0 text-base" />
            <span className={collapsed ? "md:hidden" : ""}>Todas mis residencias</span>
          </Link>
        </div>

        <div className="border-t border-line p-4">
          <p className={`truncate px-1 text-xs text-ink-faint ${collapsed ? "md:hidden" : ""}`}>{userEmail}</p>
          <Link
            href={`${base}/profile`}
            title="Editar perfil"
            aria-label="Editar perfil"
            className={`mt-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${collapsed ? "md:justify-center" : ""}`}
          >
            <Icon name="edit" className="shrink-0 text-lg" />
            <span className={collapsed ? "md:hidden" : ""}>Editar perfil</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title="Salir"
              aria-label="Salir"
              className={`mt-1 flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${collapsed ? "md:justify-center" : ""}`}
            >
              <Icon name="logout" className="shrink-0 text-lg" />
              <span className={collapsed ? "md:hidden" : ""}>Salir</span>
            </button>
          </form>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="absolute -right-3 top-7 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-ink-soft shadow-sm transition-colors hover:border-forest hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:flex"
        >
          <Icon
            name="chevron_left"
            className={`text-base transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </aside>
    </>
  );
}
