/**
 * Permisos del equipo de una residencia (DR11, docs/00 §31 y docs/05 §4.7). Lógica PURA: sin base de datos ni `server-only`, así la usan
 * el servidor (la regla real, vía `assertResidencePermission` / `assertResidenceOwner` en `access.ts`) y la interfaz (solo para
 * deshabilitar o mostrar una nota).
 *
 * Modelo (reemplaza al "un solo nivel de staff" de DR10):
 *  - `owner`: el dueño puede TODO en su residencia. Es el único que gestiona el equipo y sus permisos.
 *  - `staff`: el dueño elige, staff por staff, qué acciones puede hacer (10 casilleros, abajo). Los permisos viven en
 *    `residence_users.permissions` (jsonb, por miembro y por residencia: la misma persona puede tener permisos distintos en dos
 *    residencias). No hace falta migración: la columna existe desde la 0003.
 *  - Siempre disponible para todo staff activo, sin casillero: ver el panel y las pantallas en solo lectura, abrir un caso de Soporte
 *    y recibir notificaciones.
 *  - Solo el dueño, NO delegable (`OWNER_ONLY_ACTIONS`): gestionar el equipo y sus permisos, sumar otra residencia, enviar o reenviar el
 *    perfil a verificación y el reporte PDF del portfolio.
 *
 * Falla cerrado: una clave desconocida, un valor que no sea booleano o una membresía ausente NO habilitan nada.
 */

export type ResidenceRole = "owner" | "staff";

export const STAFF_PERMISSION_GROUPS = [
  { id: "applications", label: "Solicitudes y pagos" },
  { id: "operations", label: "Operación del día a día" },
  { id: "profile", label: "Perfil de la residencia" },
] as const;
export type StaffPermissionGroup = (typeof STAFF_PERMISSION_GROUPS)[number]["id"];

/**
 * Los 10 permisos delegables, con etiqueta, descripción corta y valor inicial (aprobados por el dueño del producto, DR11). El orden es el
 * de la pantalla Equipo. `defaultEnabled` es el valor inicial al invitar y también el que se usa para una clave AUSENTE (staff creados
 * antes de DR11 sin permisos guardados: su comportamiento no cambia, salvo los permisos 4 y 10 que el staff nunca tuvo y quedan apagados).
 */
export const STAFF_PERMISSIONS = [
  {
    key: "applications.review_contact",
    group: "applications",
    label: "Revisar solicitudes y establecer contacto",
    description: "Marcar solicitudes en revisión y establecer el contacto con el estudiante.",
    defaultEnabled: true,
  },
  {
    key: "applications.reject",
    group: "applications",
    label: "Rechazar solicitudes",
    description: "Rechazar una solicitud indicando el motivo.",
    defaultEnabled: true,
  },
  {
    key: "payments.residence",
    group: "applications",
    label: "Pago a la residencia",
    description: "Habilitar el pago a la residencia, marcar el pago como recibido y ver los documentos de esos solicitantes.",
    defaultEnabled: true,
  },
  {
    key: "applications.send_adjustment",
    group: "applications",
    label: "Proponer un ajuste de condiciones",
    description: "Enviar una propuesta que cambia el precio o las fechas de una solicitud.",
    defaultEnabled: false,
  },
  {
    key: "operations.rooms_availability",
    group: "operations",
    label: "Habitaciones y disponibilidad",
    description: "Editar habitaciones y camas, y actualizar la disponibilidad (incluye pausar solicitudes por tipo).",
    defaultEnabled: true,
  },
  {
    key: "residents.manage",
    group: "operations",
    label: "Residentes",
    description: "Altas, salidas, notas, documentos de los residentes y respuestas a \"Quiero cambiar\" y a salidas anticipadas.",
    defaultEnabled: true,
  },
  {
    key: "renewals.manage",
    group: "operations",
    label: "Renovaciones",
    description: "Crear y enviar ofertas de renovación y marcar el pago.",
    defaultEnabled: true,
  },
  {
    key: "waitlist.manage",
    group: "operations",
    label: "Lista de espera",
    description: "Avisar disponibilidad y quitar personas de la lista de espera.",
    defaultEnabled: true,
  },
  {
    key: "faq.manage",
    group: "operations",
    label: "Preguntas de la ficha",
    description: "Responder, ocultar y restaurar preguntas.",
    defaultEnabled: true,
  },
  {
    key: "profile.edit",
    group: "profile",
    label: "Editar perfil, tarifas y condiciones",
    description: "Guardar cambios en el perfil, las tarifas y las condiciones de reserva. Enviarlo a verificación sigue siendo solo del dueño.",
    defaultEnabled: false,
  },
] as const;

export type ResidencePermission = (typeof STAFF_PERMISSIONS)[number]["key"];
export type PermissionMap = Record<ResidencePermission, boolean>;

export const RESIDENCE_PERMISSION_KEYS: readonly ResidencePermission[] = STAFF_PERMISSIONS.map((p) => p.key);

/** Acciones que SOLO puede hacer el dueño y no se delegan (sin casillero). */
export const OWNER_ONLY_ACTIONS = [
  "team.manage",
  "residence.add",
  "profile.submit_verification",
  "reports.portfolio_pdf",
] as const;
export type OwnerOnlyAction = (typeof OWNER_ONLY_ACTIONS)[number];

/** Lo que todo staff activo puede hacer siempre, sin casillero (documentación y tests). */
export const ALWAYS_AVAILABLE_TO_STAFF = ["view_panel_read_only", "support.open", "notifications.read"] as const;

/** Mensaje único cuando el staff no tiene el permiso (el servidor lo devuelve tal cual). */
export const PERMISSION_DENIED_MESSAGE = "No tenés permiso para esta acción. Pedíselo al dueño de la residencia.";
/** Mensaje único para lo no delegable (equipo, verificación, PDF, sumar residencia). */
export const OWNER_ONLY_MESSAGE = "Esta acción la puede hacer solo el dueño de la residencia.";
/** Nota corta para la interfaz cuando algo de lo no delegable queda en solo lectura para el staff. */
export const OWNER_ONLY_NOTE = "Solo el dueño puede editar esto.";
/** Nota corta para la interfaz cuando un permiso delegable está apagado. */
export const NO_PERMISSION_NOTE = "Pedile este permiso al dueño.";

export function isResidencePermission(value: unknown): value is ResidencePermission {
  return typeof value === "string" && (RESIDENCE_PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Valores iniciales (los casilleros que se ven tildados al invitar a alguien). */
export function defaultPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) map[p.key] = p.defaultEnabled;
  return map;
}

/** `true` si el valor es un objeto JSON "plano" (ni nulo, ni lista, ni texto, ni número). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Mapa con todo apagado (lo que resuelve un valor guardado que no es un objeto: falla cerrado). */
export function noPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) map[p.key] = false;
  return map;
}

/**
 * Convierte lo guardado en `residence_users.permissions` (jsonb) en el mapa COMPLETO de un staff. Falla cerrado:
 *  - Si el valor guardado NO es un objeto (nulo, lista, texto, número, ausente) → todo apagado. Nunca se interpreta como "valores
 *    iniciales": un dato corrupto no puede dar permisos.
 *  - Solo un objeto VACÍO `{}` (los staff anteriores a DR11, sin permisos guardados) toma los valores iniciales.
 *  - En un objeto con claves, por cada clave: `true` → sí, `false` → no, ausente → valor inicial; cualquier otro valor (texto, número,
 *    objeto, null) → no. Las claves desconocidas se ignoran.
 */
export function resolveStaffPermissions(raw: unknown): PermissionMap {
  if (!isPlainObject(raw)) return noPermissions();
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) {
    const value = Object.hasOwn(raw, p.key) ? raw[p.key] : undefined;
    map[p.key] = value === undefined ? p.defaultEnabled : value === true;
  }
  return map;
}

/**
 * Parser ESTRICTO para lo que escribe el dueño (invitar con permisos iniciales, guardar los permisos de un staff): el mapa llega
 * COMPLETO de los casilleros, así que una clave ausente es `false` (nunca el valor inicial: sería dar más permisos de los elegidos). Solo
 * `true` literal enciende un permiso; un valor que no sea un objeto apaga todo; las claves desconocidas se ignoran.
 */
export function parseStrictPermissions(raw: unknown): PermissionMap {
  if (!isPlainObject(raw)) return noPermissions();
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) map[p.key] = Object.hasOwn(raw, p.key) && raw[p.key] === true;
  return map;
}

/**
 * Versión de un mapa de permisos para el control de concurrencia de la pantalla Equipo (un dígito por clave, en el orden de la lista):
 * si dos pestañas o dos dueños editan a la vez, el guardado condicional compara esta versión con la que leyó el formulario. No es un
 * secreto ni un token de seguridad; solo detecta que los permisos efectivos cambiaron mientras se editaba.
 */
export function permissionsVersion(map: PermissionMap): string {
  return STAFF_PERMISSIONS.map((p) => (map[p.key] ? "1" : "0")).join("");
}

/** Mapa con todo encendido (lo que tiene siempre el dueño). */
export function ownerPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) map[p.key] = true;
  return map;
}

/** Vínculo activo con una residencia: el rol y los permisos YA resueltos (ver `getResidenceMembership`). */
export type ResidenceMembership = { role: ResidenceRole; permissions: PermissionMap };

/**
 * ¿Puede esta persona hacer esto en esta residencia? El dueño siempre; el staff solo si la clave está encendida en su mapa. Sin
 * membresía, con una clave desconocida o con un mapa ausente: no (falla cerrado).
 */
export function can(
  membership: { role: ResidenceRole; permissions?: Partial<Record<string, boolean>> } | null | undefined,
  permission: ResidencePermission,
): boolean {
  if (!membership) return false;
  if (!isResidencePermission(permission)) return false;
  if (membership.role === "owner") return true;
  if (membership.role !== "staff") return false;
  return membership.permissions?.[permission] === true;
}

/** Atajos de la pantalla Equipo: rellenan los casilleros (el dueño después los ajusta y guarda). */
export const PERMISSION_PRESETS = [
  {
    id: "read_only",
    label: "Solo lectura",
    description: "Ve todo, no hace nada.",
    enabled: [] as readonly ResidencePermission[],
  },
  {
    id: "applications",
    label: "Atención de solicitudes",
    description: "Revisa y rechaza solicitudes, maneja el pago a la residencia, la lista de espera y las preguntas.",
    enabled: [
      "applications.review_contact",
      "applications.reject",
      "payments.residence",
      "waitlist.manage",
      "faq.manage",
    ] as readonly ResidencePermission[],
  },
  {
    id: "full_operation",
    label: "Operación completa",
    description: "Todo lo del día a día, sin proponer ajustes ni editar el perfil.",
    enabled: STAFF_PERMISSIONS.filter((p) => p.key !== "applications.send_adjustment" && p.key !== "profile.edit").map(
      (p) => p.key,
    ) as readonly ResidencePermission[],
  },
] as const;
export type PermissionPresetId = (typeof PERMISSION_PRESETS)[number]["id"];

export function presetPermissions(id: PermissionPresetId): PermissionMap {
  const preset = PERMISSION_PRESETS.find((p) => p.id === id);
  const enabled = new Set<string>(preset?.enabled ?? []);
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) map[p.key] = enabled.has(p.key);
  return map;
}

/**
 * Lee los casilleros enviados por un formulario: `values` es la lista de claves tildadas (los `name="permission"` del FormData). Una
 * clave tildada y conocida es `true`; todo lo demás (no tildada, desconocida, repetida) queda `false`. Siempre devuelve el mapa completo.
 */
export function permissionsFromChecked(values: readonly unknown[]): PermissionMap {
  const checked = new Set(values.filter(isResidencePermission));
  const map = {} as PermissionMap;
  for (const p of STAFF_PERMISSIONS) map[p.key] = checked.has(p.key);
  return map;
}

/** Claves que cambian entre dos mapas completos (para auditar `team_permissions_changed`). */
export function diffPermissions(before: PermissionMap, after: PermissionMap): { key: ResidencePermission; from: boolean; to: boolean }[] {
  return STAFF_PERMISSIONS.filter((p) => before[p.key] !== after[p.key]).map((p) => ({ key: p.key, from: before[p.key], to: after[p.key] }));
}

/** Etiqueta en español de un permiso (para auditoría y avisos). */
export function permissionLabel(key: string): string {
  return STAFF_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
}

/** Normaliza el valor guardado en `residence_users.role`: cualquier cosa que no sea `owner` se trata como `staff` (mínimo privilegio). */
export function normalizeResidenceRole(value: unknown): ResidenceRole {
  return value === "owner" ? "owner" : "staff";
}

/**
 * ¿Esta fila de `residence_users` (rol + permisos crudos) puede hacer esto? Para filtrar destinatarios de avisos. El dueño siempre; el
 * staff según `resolveStaffPermissions` (falla cerrado: sin objeto de permisos guardado no recibe nada).
 */
export function rowCan(row: { role?: unknown; permissions?: unknown }, permission: ResidencePermission): boolean {
  const role = normalizeResidenceRole(row.role);
  return can({ role, permissions: role === "owner" ? ownerPermissions() : resolveStaffPermissions(row.permissions) }, permission);
}

/** Rol con el que se audita lo que hace una persona DENTRO de una residencia (`audit_logs.actor_role`, `application_status_events.changed_by_role`). */
export type ResidenceActorRole = "residence_owner" | "residence_staff";

/**
 * Rol de auditoría según el vínculo con ESA residencia (no el rol global de la cuenta): dueño → `residence_owner`, staff → `residence_staff`.
 * Sin vínculo devuelve `null`: quien llama ya tiene que haber rechazado la acción (falla cerrado) antes de escribir nada.
 */
export function residenceActorRole(membership: { role: ResidenceRole }): ResidenceActorRole;
export function residenceActorRole(membership: { role: ResidenceRole } | null | undefined): ResidenceActorRole | null;
export function residenceActorRole(membership: { role: ResidenceRole } | null | undefined): ResidenceActorRole | null {
  if (!membership) return null;
  return membership.role === "owner" ? "residence_owner" : "residence_staff";
}
