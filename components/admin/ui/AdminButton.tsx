import type { ComponentPropsWithoutRef } from "react";
import { cmd } from "@/components/admin/ui/tokens";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function AdminButton({
  variant = "secondary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant }) {
  const style: Record<string, string> =
    variant === "primary"
      ? { backgroundColor: cmd.primary, color: "#fff" }
      : variant === "danger"
        ? { backgroundColor: cmd.rose, color: "#fff" }
        : variant === "ghost"
          ? { backgroundColor: "transparent", color: cmd.onSurfaceVariant }
          : { backgroundColor: "#fff", color: cmd.onSurfaceVariant, border: `1px solid ${cmd.outline}` };

  return <button {...props} className={`${base} ${className}`} style={style} />;
}
