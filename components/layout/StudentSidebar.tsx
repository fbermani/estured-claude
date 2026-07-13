"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { signOut } from "@/app/(public)/login/actions";

const NAV = [
  { href: "/students/dashboard", label: "Inicio", icon: "home" },
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
 * Sin "Mensajes"/"Favoritos" de la referencia — no existen en el modelo
 * de datos real (chat propio prohibido, favoritos no construido).
 */
export function StudentSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-line bg-paper">
      <div>
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2" aria-label="EstuRed, inicio">
            <span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-forest font-display text-lg font-extrabold text-white">
              E
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink">EstuRed</span>
          </Link>
          <NotificationBell />
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
      </div>

      <div className="border-t border-line p-4">
        <p className="truncate px-1 text-xs text-ink-faint">{userEmail}</p>
        <Link href="/students/revocation" className="mt-2 flex items-center gap-2 rounded-field px-3 py-2 text-sm font-medium text-ink-soft hover:bg-cream-2">
          <Icon name="undo" className="text-lg" /> Botón de arrepentimiento
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
