import { defineConfig } from "@playwright/test";

/**
 * Pruebas E2E contra STAGING (estured.vercel.app → estured-dev). Nunca producción:
 * `e2e/helpers.ts` aborta si el host no está en la lista permitida o si la página no muestra el selector demo.
 * Correr: npx playwright test  (E2E_BASE_URL para apuntar a otro host permitido).
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://estured.vercel.app",
    trace: "off",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "e2e", testIgnore: /auth\.setup\.ts/, dependencies: ["setup"] },
  ],
  outputDir: process.env.E2E_OUT_DIR ?? "/tmp/estured-e2e-results",
});
