import { describe, expect, it } from "vitest";
import { previewBannerCopy } from "@/lib/residences/previewBanner";

describe("previewBannerCopy", () => {
  it("residencia sin publicar: dice que todavía no es pública", () => {
    for (const status of ["draft", "needs_changes", "pending_verification", "verification_scheduled", "verification_expired"]) {
      const copy = previewBannerCopy(status);
      expect(copy.lead).toBe("Vista previa de tu ficha.");
      expect(copy.body).toBe("Así la verán los estudiantes cuando se publique. Todavía no es pública.");
      expect(copy.progress).not.toBeNull();
    }
  });

  it("residencia publicada: no dice que no es pública y aclara que lo pendiente de revisión no se ve", () => {
    const copy = previewBannerCopy("verified_active");
    expect(copy.body).not.toMatch(/no es pública/i);
    expect(copy.body).toMatch(/esperan revisión/);
    expect(copy.progress?.complete).toBe(true);
  });

  it("estados fuera del recorrido (pausada, suspendida, archivada): sin afirmar nada sobre su publicación y sin etapa", () => {
    for (const status of ["suspended", "paused_by_admin", "archived", "algo_raro"]) {
      const copy = previewBannerCopy(status);
      expect(copy.progress).toBeNull();
      expect(copy.body).not.toMatch(/pública|publique/);
    }
  });

  it("nunca promete plazos ni disponibilidad", () => {
    for (const status of ["draft", "verified_active", "suspended"]) {
      const text = Object.values(previewBannerCopy(status)).filter((v) => typeof v === "string").join(" ");
      expect(text).not.toMatch(/garant|asegura|disponib/i);
    }
  });
});
