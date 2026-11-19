import { test, expect } from "@playwright/test";
import { expectHealthy } from "./helpers";

const PUBLIC_PAGES = ["/", "/search", "/guias", "/terms", "/privacy", "/nosotros", "/for-residences", "/for-students", "/login", "/forgot-password"];

test.describe("Visitante", () => {
  for (const p of PUBLIC_PAGES) {
    test(`carga ${p}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(p);
      expect(res?.status(), p).toBeLessThan(400);
      await expectHealthy(page);
      await expect(page.locator("h1, h2").first()).toBeVisible();
      expect(errors, `errores de JS en ${p}`).toEqual([]);
    });
  }

  test("404 propio", async ({ page }) => {
    const res = await page.goto("/esta-pagina-no-existe-xyz");
    expect(res?.status()).toBe(404);
  });

  for (const p of ["/students/dashboard", "/residence/dashboard", "/admin/dashboard"]) {
    test(`${p} sin sesión manda a login`, async ({ page }) => {
      await page.goto(p);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("buscador → ficha de una residencia", async ({ page }) => {
    await page.goto("/search");
    const link = page.locator('a[href^="/residencias/"]').first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    const href = await link.getAttribute("href");
    await page.goto(href!);
    await expectHealthy(page);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("robots, sitemap y llms responden", async ({ request }) => {
    for (const p of ["/robots.txt", "/sitemap.xml", "/llms.txt"]) {
      const r = await request.get(p);
      expect(r.status(), p).toBe(200);
    }
  });

  test("cabeceras de seguridad básicas", async ({ request }) => {
    const r = await request.get("/");
    const h = r.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["strict-transport-security"] ?? "").toContain("max-age");
    expect(h["content-security-policy"] ?? h["content-security-policy-report-only"] ?? "").not.toBe("");
  });

  test("rutas internas de API no aceptan GET anónimo de datos", async ({ request }) => {
    const r = await request.get("/api/cron/expire");
    expect([401, 403, 404, 405]).toContain(r.status());
  });
});
