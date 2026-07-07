import type { ReactNode } from "react";
import { cmd } from "@/components/admin/ui/tokens";

/** Surface 1 del design system "Operational Command": blanco + borde 1px, radio 8px. */
export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg bg-white ${className}`}
      style={{ border: `1px solid ${cmd.border}` }}
    >
      {children}
    </div>
  );
}
