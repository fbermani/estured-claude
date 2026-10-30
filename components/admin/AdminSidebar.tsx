"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cmd } from "@/components/admin/ui/tokens";
import { signOut } from "@/app/(public)/login/actions";
import { useSidebarCollapse } from "@/components/layout/useSidebarCollapse";
import { NotificationBell } from "@/components/layout/NotificationBell";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <rect x="4" y="3" width="12" height="14" rx="1" />
      <path strokeLinecap="round" d="M7 7h1M12 7h1M7 10h1M12 10h1M7 13h1M12 13h1" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="10" cy="10" r="7" />
      <path strokeLinecap="round" d="M10 6v4l2.5 2.5" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="7.5" cy="7" r="2.5" />
      <path strokeLinecap="round" d="M2.5 16c0-2.5 2-4.2 5-4.2s5 1.7 5 4.2" />
      <circle cx="14.5" cy="8" r="2" />
      <path strokeLinecap="round" d="M13 11.5c2.2.2 3.7 1.7 3.7 4" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11h3.5l2-6 3 12 2-9 1.5 3H17" />
    </svg>
  );
}
function PaymentsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="10" cy="10" r="7" />
      <path strokeLinecap="round" d="M10 6.5v7M8 8.2c0-.8.9-1.4 2-1.4s2 .6 2 1.4-.9 1.2-2 1.4c-1.1.2-2 .6-2 1.4s.9 1.4 2 1.4 2-.6 2-1.4" />
    </svg>
  );
}
function ExchangeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h9l-2.5-2.5M16 13H7l2.5 2.5" />
    </svg>
  );
}
function FamilyProposalsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l7 5 7-5M4 4h12a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" />
    </svg>
  );
}
function ValidationsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3h9l3 3v11H4V3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10.5l2 2 4-4.5" />
    </svg>
  );
}
function ProfileEditsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3h7l3 3v3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v14h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 11.5l2 2L11 19H9v-2l5.5-5.5z" />
    </svg>
  );
}
function PricingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.5v15M14 5.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.3 4 2.5c2.2.2 4 1.1 4 2.5s-1.8 2.5-4 2.5-4-1.1-4-2.5" />
    </svg>
  );
}
function DocumentsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4a1.5 1.5 0 011.5-1.5h5l4 4v9a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 014 15.5V4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 2.5V6a1 1 0 001 1H15" />
    </svg>
  );
}
function CommunityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="7" cy="7" r="2.3" />
      <circle cx="14" cy="8" r="1.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16c0-2.4 1.8-4.3 4-4.3s4 1.9 4 4.3M12.5 12.3c1.8.1 3.2 1.7 3.2 3.7" />
    </svg>
  );
}
function VisibilityIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 10s2.8-5.5 8-5.5S18 10 18 10s-2.8 5.5-8 5.5S2 10 2 10z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}
function SupportCasesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <circle cx="10" cy="10" r="7.5" />
      <path strokeLinecap="round" d="M7.6 7.8a2.4 2.4 0 014.5 1.1c0 1.6-2.2 1.6-2.2 3.1" />
      <circle cx="10" cy="14.2" r="0.15" fill="currentColor" />
    </svg>
  );
}
const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/admin/residences", label: "Residencias", Icon: BuildingIcon },
  { href: "/admin/verifications", label: "Verificaciones", Icon: ValidationsIcon },
  { href: "/admin/profile-edits", label: "Ediciones de perfil", Icon: ProfileEditsIcon },
  { href: "/admin/pricing", label: "Administración de tarifas", Icon: PricingIcon },
  { href: "/admin/documents", label: "Documentos", Icon: DocumentsIcon },
  { href: "/admin/community", label: "Comunidad", Icon: CommunityIcon },
  { href: "/admin/visibility", label: "Visibilidad y penalizaciones", Icon: VisibilityIcon },
  { href: "/admin/applications", label: "Solicitudes", Icon: ClockIcon },
  { href: "/admin/family-proposals", label: "Propuestas familiar", Icon: FamilyProposalsIcon },
  { href: "/admin/payments", label: "Pagos", Icon: PaymentsIcon },
  { href: "/admin/activity", label: "Actividad", Icon: ActivityIcon },
  { href: "/admin/support-cases", label: "Soporte", Icon: SupportCasesIcon },
  { href: "/admin/faq", label: "Preguntas de fichas", Icon: SupportCasesIcon },
  { href: "/admin/custom-amenities", label: "Ítems «Otro» de fichas", Icon: ProfileEditsIcon },
  { href: "/admin/followups", label: "Seguimiento", Icon: SupportCasesIcon },
  { href: "/admin/residencias-pedidas", label: "Residencias pedidas", Icon: BuildingIcon },
  { href: "/admin/exchange-rate", label: "Tipo de cambio", Icon: ExchangeIcon },
  { href: "/admin/users", label: "Usuarios", Icon: UsersIcon },
] as const;

export function AdminSidebar({ userEmail, roleLabel }: { userEmail: string; roleLabel: string }) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarCollapse();

  return (
    <>
      {/* Barra móvil — solo visible por debajo de md, el aside pasa a ser un drawer */}
      <div
        className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden"
        style={{ borderColor: cmd.border }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color: cmd.onSurfaceVariant }}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
            <path strokeLinecap="round" d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <p className="text-sm font-extrabold tracking-tight" style={{ color: cmd.primary }}>
          EstuRed Admin
        </p>
        <NotificationBell />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col justify-between border-r bg-white transition-transform duration-200 md:static md:relative md:translate-x-0 md:transition-[width] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-[260px] md:w-[76px]" : "w-[260px]"}`}
        style={{ borderColor: cmd.border }}
      >
        <div className="min-w-0">
          <div className={`flex items-center gap-2 px-6 py-6 ${collapsed ? "md:justify-center md:px-3" : "justify-between"}`}>
            <div className={collapsed ? "md:hidden" : ""}>
              <p className="text-lg font-extrabold tracking-tight" style={{ color: cmd.primary }}>
                EstuRed Admin
              </p>
              <p className="text-xs font-medium tracking-wide" style={{ color: cmd.outline }}>
                Panel de administración
              </p>
            </div>
            <span
              className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold text-white ${collapsed ? "md:flex" : "md:hidden"}`}
              style={{ backgroundColor: cmd.primary }}
              aria-hidden
            >
              E
            </span>
            <div className={collapsed ? "md:hidden" : ""}>
              <NotificationBell />
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="rounded-lg p-1 md:hidden"
              style={{ color: cmd.onSurfaceVariant }}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
                <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${collapsed ? "md:justify-center" : ""}`}
                  style={
                    active
                      ? { backgroundColor: cmd.onPrimaryContainer, color: cmd.navActiveFg }
                      : { color: cmd.onSurfaceVariant }
                  }
                >
                  <Icon />
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t p-4" style={{ borderColor: cmd.border }}>
          <div className={`flex items-center gap-3 rounded-lg p-2 ${collapsed ? "md:justify-center" : ""}`} style={{ backgroundColor: cmd.surfaceContainerLow }}>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: cmd.primary }}
              aria-hidden
              title={userEmail}
            >
              {userEmail.charAt(0).toUpperCase()}
            </span>
            <div className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
              <p className="truncate text-xs font-semibold" style={{ color: cmd.onSurface }}>
                {userEmail}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                {roleLabel}
              </p>
            </div>
          </div>
          <form action={signOut} className={collapsed ? "md:hidden" : ""}>
            <button
              type="submit"
              className="mt-2 w-full rounded px-3 py-1.5 text-left text-xs font-semibold"
              style={{ color: cmd.rose }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        {/* Toggle de colapso — solo desktop, flota sobre el borde derecho */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="absolute -right-3 top-7 hidden h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm md:flex"
          style={{ borderColor: cmd.border, color: cmd.onSurfaceVariant }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-6 6 6 6" />
          </svg>
        </button>
      </aside>
    </>
  );
}
