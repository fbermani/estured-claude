/**
 * Mapa de pantallas del flujo de preapertura para el navegador «Pantallas (dev)» (solo desarrollo). Módulo puro. Cada pantalla declara
 * el ESTADO de sesión que necesita; el enlace pasa por `/dev-preapertura/preparar`, que deja ese estado (cuenta de prueba, sesión o
 * sin sesión) y recién entonces redirige: así ninguna pantalla da un redirect sin sentido ni un error por falta de sesión.
 */
export const DEV_STATES = ["anon", "incompleto", "completo", "fam-pend", "fam-vinc"] as const;
export type DevState = (typeof DEV_STATES)[number];

export type DevScreen = {
  id: string;
  label: string;
  state: DevState;
  /** Ruta + query a abrir (el query solo distingue variantes; ver `matchKey`). */
  path: string;
  /** Parámetro del query que identifica la variante cuando varias pantallas comparten ruta. */
  matchKey?: "v" | "dev";
};

export const DEV_SCREENS: readonly DevScreen[] = [
  { id: "entrada", label: "Entrada (popup + CTA fundadoras)", state: "anon", path: "/" },
  { id: "paso1", label: "Paso 1: crear cuenta", state: "anon", path: "/preregistro" },
  { id: "perfil", label: "Paso 2: armá tu perfil", state: "incompleto", path: "/preregistro/perfil" },
  { id: "familiar", label: "Registro familiar", state: "anon", path: "/preregistro/familiar" },
  { id: "lugar-completo", label: "Mi lugar: estudiante, perfil completo", state: "completo", path: "/mi-lugar?v=completo", matchKey: "v" },
  { id: "lugar-incompleto", label: "Mi lugar: estudiante, perfil incompleto", state: "incompleto", path: "/mi-lugar?v=incompleto", matchKey: "v" },
  { id: "lugar-fam-pend", label: "Mi lugar: familiar, invitación esperando", state: "fam-pend", path: "/mi-lugar?v=fam-pend", matchKey: "v" },
  { id: "lugar-fam-vinc", label: "Mi lugar: familiar, vinculados", state: "fam-vinc", path: "/mi-lugar?v=fam-vinc", matchKey: "v" },
  { id: "fundadoras", label: "Fundadoras", state: "anon", path: "/fundadoras" },
  { id: "datos", label: "Fundadoras: formulario de 5 datos", state: "anon", path: "/register/residence" },
  { id: "exito", label: "Solicitud enviada, con lugar de fundadora", state: "anon", path: "/register/residence?dev=cupo", matchKey: "dev" },
  { id: "exito-lleno", label: "Solicitud enviada, 10 lugares en proceso", state: "anon", path: "/register/residence?dev=lleno", matchKey: "dev" },
  { id: "legales", label: "Términos y privacidad", state: "anon", path: "/consentimientos" },
];

export function devPrepareHref(screen: DevScreen): string {
  return `/dev-preapertura/preparar?estado=${screen.state}&next=${encodeURIComponent(screen.path)}`;
}

/** ¿La URL actual corresponde a esta pantalla? (ruta exacta + variante por query si la pantalla la declara). */
export function isCurrentDevScreen(screen: DevScreen, pathname: string, params: { get(name: string): string | null }): boolean {
  const [path, query] = screen.path.split("?");
  if (path !== pathname) return false;
  if (!screen.matchKey) {
    // Sin variante propia: no tiene que haber otra pantalla de la misma ruta con variante en la URL.
    const sameRoute = DEV_SCREENS.filter((s) => s.path.split("?")[0] === path && s.matchKey);
    return !sameRoute.some((s) => params.get(s.matchKey!) != null) ;
  }
  const expected = new URLSearchParams(query).get(screen.matchKey);
  return params.get(screen.matchKey) === expected;
}

export function findDevScreenByPath(path: string): DevScreen | undefined {
  return DEV_SCREENS.find((s) => s.path === path);
}
