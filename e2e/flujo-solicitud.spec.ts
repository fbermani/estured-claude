import { test, expect } from "@playwright/test";
import { contextFor, expectHealthy } from "./helpers";

/**
 * Flujo de escritura: Camila (estudiante) pide un lugar → la solicitud aparece en su lista → el dueño la ve.
 * Deja UNA solicitud en estured-dev: limpiar con e2e/tools/cleanup-e2e-applications.mjs <ISO-desde> --apply.
 * Correr en serie y NUNCA junto con vitest (comparten usuarios demo y el tope de 2 solicitudes activas).
 */
test.describe.configure({ mode: "serial" });

test("Camila envía una solicitud desde la ficha", async ({ browser }) => {
  const ctx = await contextFor(browser, "camila");
  const page = await ctx.newPage();
  await page.goto("/residencias/wanna-tango");
  await page.getByRole("button", { name: /Pedir esta habitación/ }).first().click();
  // Paso 1: tipo de habitación (primera tarjeta), fecha, duración
  const dialog = page.locator("form").filter({ has: page.locator('input[name="desired_start_date"]') }).first();
  await dialog.locator('input[type="radio"][name="room_type_id"]').first().check({ force: true }).catch(() => {});
  const start = new Date(); start.setMonth(start.getMonth() + 3);
  await dialog.locator('input[name="desired_start_date"]').fill(start.toISOString().slice(0, 10));
  await dialog.locator('input[name="initial_duration_months"]').fill("6");
  await dialog.getByRole("button", { name: "Continuar" }).click();
  // Paso 2: objetivo, reglamento, envío
  await dialog.getByRole("button", { name: /intercambio|estudiar|carrera|posgrado|Otro/i }).first().click();
  await dialog.locator('input[name="accept_regulation"]').check();
  await dialog.getByRole("button", { name: /Enviar solicitud de reserva/ }).click();
  await expect(page.getByText(/solicitud (fue )?enviada|Enviamos tu solicitud|Solicitud enviada/i).first()).toBeVisible({ timeout: 40_000 });
  await ctx.close();
});

test("la solicitud figura en «Mis solicitudes»", async ({ browser }) => {
  const ctx = await contextFor(browser, "camila");
  const page = await ctx.newPage();
  await page.goto("/students/applications");
  await expectHealthy(page);
  await expect(page.getByText(/Wanna Tango|wanna-tango/i).first()).toBeVisible({ timeout: 30_000 });
  await ctx.close();
});
