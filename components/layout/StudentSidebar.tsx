"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOut } from "@/app/(public)/login/actions";
import { useSidebarCollapse } from "@/components/layout/useSidebarCollapse";

type NavItem = { href: string; label: string; icon: string };

const NAV_BASE = {
  home: { href: "/students/dashboard", label: "Inicio", icon: "home" },
  search: { href: "/search", label: "Buscar residencias", icon: "search" },
  profile: { href: "/students/profile", label: "Mi perfil", icon: "person" },
  favorites: { href: "/students/favorites", label: "Favoritos", icon: "favorite" },
  applications: { href: "/students/applications", label: "Mis solicitudes", icon: "description" },
  waitlist: { href: "/students/waitlist", label: "Lista de espera", icon: "hourglass_top" },
  residencySearching: { href: "/students/residency", label: "Mi estadía", icon: "apartment" },
  residencyHoused: { href: "/students/residency", label: "Mi residencia", icon: "apartment" },
  renewals: { href: "/students/renewals", label: "Renovaciones", icon: "sync" },
  support: { href: "/students/support", label: "Soporte", icon: "support_agent" },
} as const satisfies Record<string, NavItem>;

/**
 * Orden por estado (Ciclo 38): el estudiante en búsqueda prioriza buscar,
 * favoritos, solicitudes y completar el perfil; el estudiante alojado
 * prioriza su residencia y la renovación por sobre la búsqueda. "Mi
 * estadía" pasa a llamarse "Mi residencia" una vez alojado. Renovaciones
 * se oculta mientras el estudiante busca — sin reserva confirmada la
 * pantalla no tiene nada que mostrar (ver app/students/renewals/page.tsx).
 */
function buildNav(isHoused: boolean, searchingChange: boolean): NavItem[] {
  const nav = buildNavByState(isHoused);
  // Con un aviso "Quiero cambiar" abierto, el alojado vuelve a ver "Buscar residencias" debajo de Mi residencia (DR3).
  if (isHoused && searchingChange) nav.splice(nav.indexOf(NAV_BASE.residencyHoused) + 1, 0, NAV_BASE.search);
  // "Mi perfil": el estudiante edita su ficha y el familiar (DR4) su propio perfil, en la misma ruta.
  return nav;
}

function buildNavByState(isHoused: boolean): NavItem[] {
  if (isHoused) {
    return [
      NAV_BASE.home,
      NAV_BASE.residencyHoused,
      NAV_BASE.renewals,
      NAV_BASE.applications,
      NAV_BASE.profile,
      NAV_BASE.favorites,
      NAV_BASE.waitlist,
      NAV_BASE.support,
    ];
  }
  return [
    NAV_BASE.home,
    NAV_BASE.search,
    NAV_BASE.favorites,
    NAV_BASE.applications,
    NAV_BASE.waitlist,
    NAV_BASE.profile,
    NAV_BASE.residencySearching,
    NAV_BASE.support,
  ];
}

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
 *
 * `isHoused` (Ciclo 38) reordena y renombra el menú según el estado real
 * del estudiante (docs/04 §7: reserva confirmada) — ver app/students/layout.tsx.
 * Para familiares llega siempre en `false` (conservan el orden de búsqueda).
 */
export function StudentSidebar({
  userEmail,
  isHoused,
  searchingChange = false,
}: {
  userEmail: string;
  isHoused: boolean;
  /** `true` si el alojado tiene un aviso "Quiero cambiar" abierto: vuelve el ítem "Buscar residencias". */
  searchingChange?: boolean;
}) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapse();
  const nav = buildNav(isHoused, searchingChange);

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
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${
                    active ? "bg-(--tone-tint) text-(--tone-700)" : "text-ink-soft hover:bg-cream-2"
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
            className={`mt-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${collapsed ? "md:justify-center" : ""}`}
          >
            <Icon name="undo" className="shrink-0 text-lg" />
            <span className={collapsed ? "md:hidden" : ""}>Botón de arrepentimiento</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title="Salir"
              aria-label="Salir"
              className={`mt-1 flex w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${collapsed ? "md:justify-center" : ""}`}
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
          className="absolute -right-3 top-7 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-paper text-ink-soft shadow-sm transition-colors hover:border-(--tone) hover:text-(--tone-700) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) md:flex"
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
