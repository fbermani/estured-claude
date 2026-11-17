"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { BrandMark } from "@/components/ui/BrandMark";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOut } from "@/app/(public)/login/actions";
import { useSidebarCollapse } from "@/components/layout/useSidebarCollapse";
import { MobileTabBar, type TabItem } from "@/components/layout/MobileTabBar";
import { PremiumTag } from "@/components/residences/PremiumLock";
import { NewTag } from "@/components/layout/NewTag";

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
export function ResidenceSidebar({
  residenceId,
  userEmail,
  residentsBadge = 0,
  applicationsBadge = 0,
  faqBadge = 0,
  isOwner = false,
  canEditProfile = false,
  premiumLocked = false,
  shareIsNew = false,
}: {
  residenceId: string;
  userEmail: string;
  /** Avisos "Quiero cambiar" sin responder (DR3): contador naranja en "Residentes". */
  residentsBadge?: number;
  /** Solicitudes nuevas sin revisar: contador en "Solicitudes". */
  applicationsBadge?: number;
  /** Preguntas públicas sin responder: contador en "Preguntas". */
  faqBadge?: number;
  /** DR10: el dueño ve "Equipo" y "Editar perfil"; el staff ve el perfil en solo lectura y no ve "Equipo". Solo presentación. */
  isOwner?: boolean;
  /** DR11: quien tiene `profile.edit` (el dueño siempre) ve "Editar perfil"; el resto "Ver perfil". Solo presentación. */
  canEditProfile?: boolean;
  /** DR17: la residencia no tiene Gestión Operativa (Plan Premium): remarca esas secciones. Solo presentación, nada se bloquea (D8). */
  premiumLocked?: boolean;
  /** Etiqueta «Nuevo» en «Compartir ficha» (se apaga sola en la fecha de `lib/share/newBadge.ts`; la resuelve el layout). */
  shareIsNew?: boolean;
}) {
  const pathname = usePathname();
  const base = `/residence/${residenceId}`;
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, drawerInert, menuButtonRef, closeButtonRef, drawerRef } =
    useSidebarCollapse();

  const NAV: { href: string; label: string; icon: string; exact?: boolean; badge?: number; badgeNoun?: string; premium?: boolean; isNew?: boolean }[] = [
    { href: base, label: "Panel", icon: "dashboard", exact: true },
    { href: `${base}/applications`, label: "Solicitudes", icon: "inbox", badge: applicationsBadge, badgeNoun: "solicitudes nuevas sin revisar" },
    { href: `${base}/rooms`, label: "Habitaciones", icon: "meeting_room", premium: true },
    { href: `${base}/availability`, label: "Disponibilidad", icon: "bed" },
    { href: `${base}/renewals`, label: "Renovaciones", icon: "sync_alt", premium: true },
    { href: `${base}/residents`, label: "Residentes", icon: "groups", premium: true, badge: residentsBadge, badgeNoun: "avisos de cambio sin responder" },
    { href: `${base}/waitlist`, label: "Lista de espera", icon: "hourglass_top" },
    { href: `${base}/faq`, label: "Preguntas", icon: "forum", badge: faqBadge, badgeNoun: "preguntas sin responder" },
    { href: `${base}/regulation`, label: "Reglamento", icon: "gavel" },
    { href: `${base}/share`, label: "Compartir ficha", icon: "share", isNew: shareIsNew },
    { href: `${base}/support`, label: "Soporte", icon: "support_agent" },
    { href: `${base}/plan`, label: "Plan", icon: "workspace_premium" },
    ...(isOwner ? [{ href: `${base}/team`, label: "Equipo", icon: "supervisor_account" }] : []),
  ];

  // Tab bar móvil (L7): Panel · Solicitudes · Disponibilidad · Residentes + «Más» agrupado.
  const item = (href: string) => NAV.find((n) => n.href === href)!;
  const withTag = (n: (typeof NAV)[number]): TabItem => ({
    ...n,
    trailing: premiumLocked && n.premium ? <PremiumTag /> : undefined,
  });
  const tabItems: TabItem[] = [
    { ...item(base), exact: true },
    item(`${base}/applications`),
    { ...item(`${base}/availability`), tabLabel: "Camas" },
    item(`${base}/residents`),
  ];
  const moreGroups = [
    {
      title: "Operación",
      items: [`${base}/rooms`, `${base}/renewals`, `${base}/waitlist`].map((h) => withTag(item(h))),
    },
    {
      title: "Ficha pública",
      items: [
        {
          href: `${base}/profile`,
          label: canEditProfile ? "Editar perfil" : "Ver perfil",
          icon: canEditProfile ? "edit" : "visibility",
        },
        item(`${base}/faq`),
        item(`${base}/regulation`),
        { ...item(`${base}/share`), trailing: shareIsNew ? <NewTag /> : undefined },
      ],
    },
    {
      title: "Cuenta",
      items: [
        item(`${base}/support`),
        item(`${base}/plan`),
        ...(isOwner ? [item(`${base}/team`)] : []),
        { href: "/residence/dashboard", label: "Todas mis residencias", icon: "apartment" },
      ],
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={mobileOpen}
          aria-controls="area-nav"
          className="flex size-12 items-center justify-center rounded-field text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone)"
        >
          <Icon name="menu" className="text-xl" />
        </button>
        <BrandMark size={30} />
        <NotificationBell />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-forest-ink/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        id="area-nav"
        ref={drawerRef}
        inert={drawerInert}
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? "Menú de navegación" : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex max-md:overflow-y-auto shrink-0 flex-col justify-between border-r border-line bg-paper transition-transform duration-200 md:relative md:translate-x-0 md:transition-none ${
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
              <BrandMark size={34} />
            </Link>
            <Link
              href="/residence/dashboard"
              aria-label="Tus residencias"
              className={`hidden shrink-0 items-center justify-center ${collapsed ? "md:flex" : "md:hidden"}`}
            >
              <BrandMark variant="symbol" size={34} />
            </Link>
            <div className={collapsed ? "md:hidden" : ""}>
              <NotificationBell />
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="flex size-11 items-center justify-center rounded-field text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) md:hidden"
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
                  aria-current={active ? "page" : undefined}
                  title={item.badge ? `${item.label}: ${item.badge} ${item.badgeNoun}` : premiumLocked && item.premium ? `${item.label} (Plan Premium)` : item.label}
                  aria-label={item.badge ? `${item.label}, ${item.badge} ${item.badgeNoun}` : premiumLocked && item.premium ? `${item.label}, función del Plan Premium` : item.isNew ? `${item.label}, nuevo` : item.label}
                  className={`relative flex min-h-11 items-center gap-3 rounded-field px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${
                    active ? "bg-(--tone-tint) text-(--tone-700)" : "text-ink-soft hover:bg-cream-2"
                  } ${collapsed ? "md:justify-center" : ""}`}
                >
                  <Icon name={item.icon} className="shrink-0 text-xl" />
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                  {premiumLocked && item.premium ? (
                    <PremiumTag className={`ml-auto ${collapsed ? "md:hidden" : ""}`} />
                  ) : null}
                  {item.isNew ? <NewTag className={`ml-auto ${collapsed ? "md:hidden" : ""}`} /> : null}
                  {item.badge ? (
                    <span
                      aria-hidden
                      className={`${premiumLocked && item.premium ? "ml-1" : "ml-auto"} flex min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-xs font-bold leading-5 tabular-nums text-white ${collapsed ? "md:absolute md:right-1.5 md:top-1" : ""}`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/residence/dashboard"
            title="Todas mis residencias"
            aria-label="Todas mis residencias"
            className={`mx-3 mt-4 flex items-center gap-2 rounded-field border border-line-2 px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${collapsed ? "md:justify-center" : ""}`}
          >
            <Icon name="apartment" className="shrink-0 text-base" />
            <span className={collapsed ? "md:hidden" : ""}>Todas mis residencias</span>
          </Link>
        </div>

        <div className="border-t border-line p-4">
          <p className={`truncate px-1 text-xs text-ink-faint ${collapsed ? "md:hidden" : ""}`}>{userEmail}</p>
          <Link
            href={`${base}/profile`}
            title={canEditProfile ? "Editar perfil" : "Ver perfil"}
            aria-label={canEditProfile ? "Editar perfil" : "Ver perfil"}
            className={`mt-2 flex min-h-11 items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${collapsed ? "md:justify-center" : ""}`}
          >
            <Icon name={canEditProfile ? "edit" : "visibility"} className="shrink-0 text-lg" />
            <span className={collapsed ? "md:hidden" : ""}>{canEditProfile ? "Editar perfil" : "Ver perfil"}</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title="Salir"
              aria-label="Salir"
              className={`mt-1 flex min-h-11 w-full items-center gap-2 rounded-field px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) ${collapsed ? "md:justify-center" : ""}`}
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

      <MobileTabBar tabs={tabItems} groups={moreGroups} userEmail={userEmail} />
    </>
  );
}
