/**
 * Usuarios demo para el selector de sesión simulada (docs/17 §Usuarios
 * demo obligatorios). Solo emails y etiquetas — la contraseña común
 * vive en DEMO_USERS_PASSWORD (server-side) y los usuarios se crean
 * con scripts/seed-demo-users.mjs.
 *
 * Mantener sincronizado con scripts/seed-demo-users.mjs.
 */
export interface DemoUser {
  email: string;
  label: string;
  detail: string;
}

/** El orden de esta lista es el del selector. Sofía (staff, `staff.norte@estured.test`) sigue existiendo pero no se ofrece acá. */
export const DEMO_USERS: DemoUser[] = [
  {
    email: "camila.rojas@example.com",
    label: "Camila — Estudiante en Búsqueda",
    detail: "No vive en ninguna residencia: solicitudes y lista de espera",
  },
  {
    email: "lucia.fernandez@example.com",
    label: "Lucía — Estudiante Alojada",
    detail: "Vive en Residencia Río de la Plata",
  },
  {
    email: "valentina.sosa@example.com",
    label: "Valentina — Estudiante Menor vinculada",
    detail: "17 años, con su familiar vinculado",
  },
  {
    email: "padre.lucia@example.com",
    label: "Martín — Familiar de Valentina vinculado",
    detail: "Vínculo activo con Valentina",
  },
  {
    email: "owner.residencia.norte@example.com",
    label: "Ricardo — Dueño de Residencia",
    detail: "Owner de Residencia Norte y Río de la Plata",
  },
  {
    email: "admin.operaciones@estured.test",
    label: "Admin Operativo",
    detail: "Panel admin de EstuRed",
  },
  {
    email: "superadmin@estured.test",
    label: "SuperAdmin",
    detail: "Acceso total al panel admin",
  },
];

export const DEMO_EMAILS = new Set(DEMO_USERS.map((u) => u.email));
