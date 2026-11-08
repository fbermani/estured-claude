import type { ReactNode } from "react";
import { cmd } from "@/components/admin/ui/tokens";

/** Card FRESH del panel admin: paper + borde 1.5px + radio --r-md (22px, fresh-style.md §2 "Cards"). */
export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card bg-paper ${className}`}
      style={{ border: `1.5px solid ${cmd.border}` }}
    >
      {children}
    </div>
  );
}
