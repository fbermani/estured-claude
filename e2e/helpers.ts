import { expect, type Page, type Browser, type BrowserContext } from "@playwright/test";
import path from "node:path";
import os from "node:os";

/** Hosts permitidos: staging (apunta a estured-dev) y local. Producción (estured.com) queda afuera a propósito. */
const ALLOWED_HOSTS = new Set(["estured.vercel.app", "localhost", "127.0.0.1"]);

export const BASE_URL = process.env.E2E_BASE_URL ?? "https://estured.vercel.app";
export const AUTH_DIR = process.env.E2E_AUTH_DIR ?? path.join(os.tmpdir(), "estured-e2e-auth");

export function assertAllowedHost(): void {
  const host = new URL(BASE_URL).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`E2E abortado: ${host} no está en la lista de entornos de prueba permitidos.`);
  }
}

export interface Role {
  key: string;
  email: string;
  label: string; // texto del selector demo
  home: string;
}

export const ROLES: Role[] = [
  { key: "camila", email: "camila.rojas@example.com", label: "Camila", home: "/students/dashboard" },
  { key: "lucia", email: "lucia.fernandez@example.com", label: "Lucía", home: "/students/dashboard" },
  { key: "valentina", email: "valentina.sosa@example.com", label: "Valentina", home: "/students/dashboard" },
  { key: "martin", email: "padre.lucia@example.com", label: "Martín", home: "/students/dashboard" },
  { key: "owner", email: "owner.residencia.norte@example.com", label: "Ricardo", home: "/residence/dashboard" },
  { key: "staff", email: "staff.sinpermisos@estured.test", label: "Staff de Norte", home: "/residence/dashboard" },
  { key: "admin", email: "admin.operaciones@estured.test", label: "Admin Operativo", home: "/admin/dashboard" },
  { key: "superadmin", email: "superadmin@estured.test", label: "SuperAdmin", home: "/admin/dashboard" },
];

export const authFile = (key: string) => path.join(AUTH_DIR, `${key}.json`);

/** Inicia sesión con el selector demo (auth real de Supabase por detrás; sin tipear contraseñas). */
export async function loginWithDemoSelector(page: Page, role: Role): Promise<void> {
  assertAllowedHost();
  await page.goto("/login");
  const toggle = page.getByRole("button", { name: /Simular usuario|—|Cambiando/ }).last();
  // Si no hay selector demo, este entorno NO es de prueba: abortar.
  await expect(page.getByRole("button", { name: /Simular usuario|Estudiante|Dueño|Admin|Familiar|Staff|SuperAdmin/ }).first(), "sin selector demo: ¿es producción?").toBeVisible({ timeout: 30_000 });
  await toggle.click();
  await page.getByRole("button", { name: new RegExp(`^${role.label}`) }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

export async function contextFor(browser: Browser, key: string): Promise<BrowserContext> {
  return browser.newContext({ baseURL: BASE_URL, storageState: authFile(key) });
}

/** Texto de las pantallas de error/permiso de la app (para detectar páginas rotas). */
export const BROKEN_MARKERS = [/Application error/i, /Internal Server Error/i, /This page couldn.t load/i];

export async function expectHealthy(page: Page): Promise<void> {
  for (const m of BROKEN_MARKERS) await expect(page.locator("body")).not.toContainText(m);
}
