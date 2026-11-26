import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

const ROLES = [
  { id: "student", href: "/preregistro", label: "Soy estudiante", icon: null },
  { id: "family", href: "/preregistro/familiar", label: "Soy familiar", icon: "family_restroom" },
] as const;

/** Selector estudiante o familiar del registro (DR67 e): dos enlaces reales, el actual marcado con `aria-current`. */
export function RoleTabs({ current }: { current: "student" | "family" }) {
  return (
    <nav aria-label="Tipo de registro" className="grid grid-cols-2 gap-1 rounded-full bg-cream-2 p-1">
      {ROLES.map((role) => {
        const active = role.id === current;
        return (
          <Link
            key={role.id}
            href={role.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-center text-[15px] font-bold transition-colors duration-150 ease-fresh focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink ${
              active ? "bg-forest-ink text-paper" : "text-ink hover:bg-paper"
            }`}
          >
            {role.icon && <Icon name={role.icon} />}
            {role.label}
          </Link>
        );
      })}
    </nav>
  );
}
