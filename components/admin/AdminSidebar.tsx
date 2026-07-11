"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cmd } from "@/components/admin/ui/tokens";
import { signOut } from "@/app/(public)/login/actions";

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
function LogsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" d="M4 5h12M4 10h12M4 15h8" />
    </svg>
  );
}
function RevocationsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l12 12M16 4L4 16" />
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
function ReceiptsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h10v14l-2.5-1.5L10 17l-2.5-1.5L5 17V3z" />
      <path strokeLinecap="round" d="M7.5 7h5M7.5 10h5" />
    </svg>
  );
}

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/admin/verifications", label: "Residencias", Icon: BuildingIcon },
  { href: "/admin/applications", label: "Solicitudes", Icon: ClockIcon },
  { href: "/admin/family-proposals", label: "Propuestas familiar", Icon: FamilyProposalsIcon },
  { href: "/admin/payments", label: "Pagos", Icon: PaymentsIcon },
  { href: "/admin/revocations", label: "Revocaciones", Icon: RevocationsIcon },
  { href: "/admin/receipts", label: "Comprobantes", Icon: ReceiptsIcon },
  { href: "/admin/exchange-rate", label: "Tipo de cambio", Icon: ExchangeIcon },
  { href: "/admin/users", label: "Usuarios", Icon: UsersIcon },
  { href: "/admin/logs", label: "Logs", Icon: LogsIcon },
] as const;

export function AdminSidebar({ userEmail, roleLabel }: { userEmail: string; roleLabel: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col justify-between border-r bg-white" style={{ borderColor: cmd.border }}>
      <div>
        <div className="px-6 py-6">
          <p className="text-lg font-extrabold tracking-tight" style={{ color: cmd.primary }}>
            EstuRed Admin
          </p>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: cmd.outline }}>
            System Controller
          </p>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded px-3 py-2.5 text-sm font-semibold transition-colors"
                style={
                  active
                    ? { backgroundColor: cmd.onPrimaryContainer, color: cmd.primary }
                    : { color: cmd.onSurfaceVariant }
                }
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4" style={{ borderColor: cmd.border }}>
        <div className="flex items-center gap-3 rounded-lg p-2" style={{ backgroundColor: cmd.surfaceContainerLow }}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: cmd.primary }}
            aria-hidden
          >
            {userEmail.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold" style={{ color: cmd.onSurface }}>
              {userEmail}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              {roleLabel}
            </p>
          </div>
        </div>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="w-full rounded px-3 py-1.5 text-left text-xs font-semibold"
            style={{ color: cmd.rose }}
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
