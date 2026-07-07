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

export const DEMO_USERS: DemoUser[] = [
  {
    email: "lucia.fernandez@example.com",
    label: "Lucía — estudiante",
    detail: "Mayor de edad, de Rosario, buscando residencia",
  },
  {
    email: "camila.rojas@example.com",
    label: "Camila — estudiante internacional",
    detail: "Chilena, intercambio de 6 meses",
  },
  {
    email: "valentina.sosa@example.com",
    label: "Valentina — estudiante menor",
    detail: "17 años, requiere familiar vinculado",
  },
  {
    email: "padre.lucia@example.com",
    label: "Martín — familiar",
    detail: "Padre de Lucía (vinculación: próxima etapa)",
  },
  {
    email: "owner.residencia.norte@example.com",
    label: "Ricardo — dueño de residencia",
    detail: "Owner de Residencia Norte y Río de la Plata",
  },
  {
    email: "staff.norte@estured.test",
    label: "Sofía — staff de residencia",
    detail: "Staff con acceso a una sola residencia",
  },
  {
    email: "admin.operaciones@estured.test",
    label: "Admin operativo",
    detail: "Panel admin de EstuRed",
  },
  {
    email: "superadmin@estured.test",
    label: "Superadmin",
    detail: "Acceso total al panel admin",
  },
];

export const DEMO_EMAILS = new Set(DEMO_USERS.map((u) => u.email));
