"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOut } from "@/app/(public)/login/actions";
import { useSidebarCollapse } from "@/components/layout/useSidebarCollapse";

const NAV = [
  { href: "/students/dashboard", label: "Inicio", icon: "home" },
  { href: "/students/profile", label: "Mi perfil", icon: "person" },
  { href: "/students/favorites", label: "Favoritos", icon: "favorite" },
  { href: "/students/applications", label: "Mis solicitudes", icon: "description" },
  { href: "/students/waitlist", label: "Lista de espera", icon: "hourglass_top" },
  { href: "/students/residency", label: "Mi estadía", icon: "apartment" },
  { href: "/students/renewals", label: "Renovaciones", icon: "sync" },
  { href: "/students/support", label: "Soporte", icon: "support_agent" },
] as const;

/**
 * Sidebar de navegación del área estudiante — a semejanza estructural de
 * design-references (`estured_dashboard_inicio_user_hub_1/_2`: menú
 * lateral fijo con Inicio/Solicitudes/Mi residencia/Mi perfil). Mismo
 * patrón que `AdminSidebar`, con los tokens FRESH del sitio público.
 * Sin "Mensajes" de la referencia — chat propio prohibido (docs/03
 * §12.3). Favoritos sí existe desde Ciclo 35 (docs/02 §8.1).
 *
 * Colapsable en desktop (preferencia persistida en localStorage) y
 * drawer superpuesto en mobile — mismo mecanismo que `AdminSidebar` y
 * `ResidenceSidebar` vía `useSidebarCollapse`.
 */
export function StudentSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapse();

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
              href="/"
              className={`flex items-center gap-2 ${collapsed ? "md:hidden" : ""}`}
              aria-label="EstuRed, inicio"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-forest font-display text-lg font-extrabold text-white">
                E
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">EstuRed</span>
            </Link>
            <Link
              href="/"
              aria-label="EstuRed, inicio"
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
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active ? "bg-forest-tint text-forest-700" : "text-ink-soft hover:bg-cream-2"
                  } ${collapsed ? "md:justify-center" : ""}`}
                >
                  <Icon name={item.icon} className="shrink-0 text-xl" />
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-line p-4">
          <p className={`truncate px-1 text-xs text-ink-faint ${collapsed ? "md:hidden" : ""}`}>{userEmail}</p>
          <Link
            href="/students/revocation"
            title="Botón de arrepentimiento"
            aria-label="Botón de arrepentimiento"
            className={`mt-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-2 ${collapsed ? "md:justify-center" : ""}`}
          >
            <Icon name="undo" className="shrink-0 text-lg" />
            <span className={collapsed ? "md:hidden" : ""}>Botón de arrepentimiento</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title="Salir"
              aria-label="Salir"
              className={`mt-1 flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-cream-2 ${collapsed ? "md:justify-center" : ""}`}
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
          className="absolute -right-3 top-7 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-ink-soft shadow-sm md:flex"
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
