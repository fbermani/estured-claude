"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CommunityPreviewData } from "@/lib/students/communityVisibilitySettings";

/**
 * Lo que el estudiante está escribiendo en «Mi perfil» (sin guardar todavía). `ProfileDetailsForm` lo publica en cada cambio y
 * «Tu perfil en la comunidad» lo usa para que la vista previa se actualice en vivo. Si no hay proveedor, la vista previa usa lo guardado.
 */
export type LiveProfileValues = Pick<CommunityPreviewData, "nationality" | "career" | "originCity" | "bio" | "habits" | "interests">;

const LiveProfileContext = createContext<{ live: LiveProfileValues | null; setLive: (v: LiveProfileValues) => void } | null>(null);

export function LiveProfileProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveProfileValues | null>(null);
  const value = useMemo(() => ({ live, setLive }), [live]);
  return <LiveProfileContext.Provider value={value}>{children}</LiveProfileContext.Provider>;
}

export function useLiveProfile() {
  return useContext(LiveProfileContext);
}
