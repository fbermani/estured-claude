import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.setup.ts"],
    // Los tests de integración pegan contra el mismo Supabase real del
    // proyecto y reusan los mismos usuarios demo (docs/17) entre archivos
    // — correr archivos en paralelo puede hacer que dos tests choquen
    // sobre la misma regla de negocio compartida (ej.: "máx. 2 solicitudes
    // activas" de un mismo estudiante). Ciclo 21: se detectó como test
    // flaky real, no como bug de la app. Ver MEMORY.md.
    fileParallelism: false,
  },
});
