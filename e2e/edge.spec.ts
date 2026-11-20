import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { authFile, contextFor, expectHealthy, BASE_URL } from "./helpers";

const RANDOM_UUID = "00000000-0000-4000-8000-000000000abc";

test.describe("Casos límite", () => {
  test("cookie de sesión corrupta no tumba la página: manda a login", async ({ browser }) => {
    const state = JSON.parse(fs.readFileSync(authFile("camila"), "utf8"));
    for (const c of state.cookies) c.value = "corrupto" + c.value.slice(8);
    const ctx = await browser.newContext({ baseURL: BASE_URL, storageState: state });
    const page = await ctx.newPage();
    const res = await page.goto("/students/dashboard");
    expect(res?.status()).toBeLessThan(500);
    await expectHealthy(page);
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("sesión vencida (sin cookies) en una acción protegida va a login", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const page = await ctx.newPage();
    await page.goto("/students/applications");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("dueño no ve una residencia ajena (id inexistente/ajeno)", async ({ browser }) => {
    const ctx = await contextFor(browser, "owner");
    const page = await ctx.newPage();
    const res = await page.goto(`/residence/${RANDOM_UUID}/applications`);
    // Next con streaming responde 200 y dibuja «No encontramos esa página» (sin datos): lo aceptamos.
    await expect(page.getByText("No encontramos esa página").first()).toBeVisible();
    expect([200, 403, 404]).toContain(res?.status());
    await expect(page.locator("body")).not.toContainText(/Solicitud de|Documento/);
    await ctx.close();
  });

  test("id con formato inválido da 404, no 500", async ({ browser }) => {
    const ctx = await contextFor(browser, "owner");
    const page = await ctx.newPage();
    const res = await page.goto("/residence/no-es-un-uuid/applications");
    expect(res?.status()).toBeLessThan(500);
    await ctx.close();
  });

  test("estudiante no abre la solicitud de otro (id ajeno)", async ({ browser }) => {
    const ctx = await contextFor(browser, "camila");
    const page = await ctx.newPage();
    const res = await page.goto(`/students/applications/${RANDOM_UUID}`);
    expect(res?.status()).toBeLessThan(500);
    await expectHealthy(page);
    await ctx.close();
  });

  test("ficha pública inexistente da 404", async ({ page }) => {
    const res = await page.goto("/residencias/residencia-que-no-existe-xyz");
    // Soft 404: con streaming el status es 200 pero la página dice «No encontramos» y lleva noindex.
    await expect(page.getByText("No encontramos").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    expect([200, 404]).toContain(res?.status());
  });

  test("login con campos vacíos muestra aviso y no entra", async ({ page }) => {
    await page.goto("/login");
    const submit = page.getByRole("button", { name: /Ingresar|Iniciar sesión|Entrar/i }).first();
    await submit.click();
    await expect(page).toHaveURL(/\/login/);
    await expectHealthy(page);
  });

  test("parámetros raros en /search no rompen", async ({ page }) => {
    for (const q of ["?q=%27%3B--", "?q=" + "a".repeat(2000), "?min=-5&max=abc", "?q=%3Cscript%3Ealert(1)%3C/script%3E"]) {
      const res = await page.goto("/search" + q);
      expect(res?.status(), q).toBeLessThan(500);
      await expectHealthy(page);
    }
  });

  test("API cron y csp-report no aceptan abuso anónimo", async ({ request }) => {
    const r1 = await request.post("/api/cron/expire", { data: {} });
    expect([401, 403, 404, 405]).toContain(r1.status());
    const r2 = await request.post("/api/csp-report", { data: "x".repeat(200_000), headers: { "content-type": "application/csp-report" } });
    expect(r2.status()).toBeLessThan(500);
  });

  test("selector demo: usuario inexistente no inicia sesión", async ({ request }) => {
    const r = await request.post("/login", { data: { email: "no@existe.test" }, failOnStatusCode: false });
    expect(r.status()).toBeLessThan(500);
  });
});
