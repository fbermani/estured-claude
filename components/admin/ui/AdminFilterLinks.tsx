import Link from "next/link";
import { cmd } from "@/components/admin/ui/tokens";

export type AdminFilterLink = { key: string; label: string; href: string; on: boolean };

/** Chips de filtro del admin como enlaces (el estado vive en la URL; sin JS de cliente). */
export function AdminFilterLinks({ label, items, className = "" }: { label: string; items: AdminFilterLink[]; className?: string }) {
  return (
    <nav aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          aria-current={f.on ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${f.on ? "text-paper" : ""}`}
          style={f.on ? { backgroundColor: cmd.primary } : { border: `1.5px solid ${cmd.border}`, color: cmd.onSurfaceVariant }}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}
