import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ROLES, contextFor, expectHealthy } from "./helpers";

/** Páginas que cada rol debe poder abrir y páginas que NO (esperamos redirect/404/aviso, nunca datos ni error 500). */
const ADMIN_DIRS = fs.readdirSync(path.join(process.cwd(), "app/admin"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => `/admin/${d.name}`);

const STUDENT_OK = ["/students/dashboard", "/students/applications", "/students/profile", "/students/favorites", "/students/support", "/students/receipts", "/students/renewals"];
const DENY_FOR_STUDENT = ["/admin/dashboard", "/admin/users", "/residence/dashboard"];

const MATRIX: Record<string, { ok: string[]; deny: string[] }> = {
  camila: { ok: STUDENT_OK, deny: DENY_FOR_STUDENT },
  lucia: { ok: [...STUDENT_OK, "/students/residency", "/students/followup"], deny: DENY_FOR_STUDENT },
  valentina: { ok: ["/students/dashboard", "/students/profile", "/students/applications"], deny: DENY_FOR_STUDENT },
  martin: { ok: ["/students/dashboard", "/students/family-proposals"], deny: DENY_FOR_STUDENT },
  owner: { ok: ["/residence/dashboard"], deny: ["/admin/dashboard", "/admin/users", "/admin/logs"] },
  staff: { ok: ["/residence/dashboard"], deny: ["/admin/dashboard", "/admin/users"] },
  admin: { ok: ADMIN_DIRS, deny: [] },
  superadmin: { ok: ADMIN_DIRS, deny: [] },
};

for (const role of ROLES) {
  test.describe(`Rol ${role.key}`, () => {
    test("entra a su home sin errores", async ({ browser }) => {
      const ctx = await contextFor(browser, role.key);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(role.home);
      await expect(page).toHaveURL(new RegExp(role.home));
      await expectHealthy(page);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(errors).toEqual([]);
      await ctx.close();
    });

    for (const p of MATRIX[role.key].ok) {
      test(`abre ${p}`, async ({ browser }) => {
        const ctx = await contextFor(browser, role.key);
        const page = await ctx.newPage();
        const res = await page.goto(p);
        expect(res?.status(), p).toBeLessThan(500);
        await expectHealthy(page);
        // No debe rebotar a login (sesión válida)
        await expect(page).not.toHaveURL(/\/login/);
        await ctx.close();
      });
    }

    for (const p of MATRIX[role.key].deny) {
      test(`NO puede abrir ${p}`, async ({ browser }) => {
        const ctx = await contextFor(browser, role.key);
        const page = await ctx.newPage();
        const res = await page.goto(p);
        const url = new URL(page.url());
        const denied = !url.pathname.startsWith(p) || res?.status() === 404 || res?.status() === 403;
        expect(denied, `${role.key} vio ${p} (url final ${url.pathname}, status ${res?.status()})`).toBe(true);
        await ctx.close();
      });
    }
  });
}
