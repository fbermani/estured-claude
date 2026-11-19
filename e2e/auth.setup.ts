import { test as setup } from "@playwright/test";
import fs from "node:fs";
import { AUTH_DIR, ROLES, authFile, loginWithDemoSelector } from "./helpers";

// Una sesión por rol, guardada FUERA del repo (AUTH_DIR). Las cookies son tokens reales: no versionar.
for (const role of ROLES) {
  setup(`sesión ${role.key}`, async ({ page }) => {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await loginWithDemoSelector(page, role);
    await page.context().storageState({ path: authFile(role.key) });
  });
}
