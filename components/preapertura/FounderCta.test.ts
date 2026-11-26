import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FounderCta } from "@/components/preapertura/FounderCta";
import { PreaperturaDialog } from "@/components/preapertura/PreaperturaDialog";

/**
 * Regresión del bug «Quiero ser fundadora no funciona»: el contenedor del popup es `pointer-events-none` (el fondo no captura nada fuera
 * de la caja) y la tarjeta flotante vive DENTRO de ese contenedor; sin `pointer-events-auto` el clic la atravesaba y caía en el fondo.
 * Acá se fija el contrato en el HTML renderizado (el comportamiento real se verificó en el navegador).
 */
const none = { kind: "none" } as const;
const open = { kind: "none" } as const;

function render(variant: "modal" | "float", state: Parameters<typeof FounderCta>[0]["state"] = none): string {
  return renderToStaticMarkup(createElement(FounderCta, { state, closure: open, variant }));
}

function anchorTag(html: string): string {
  const match = /<a [^>]*>/.exec(html);
  expect(match).not.toBeNull();
  return match![0];
}

describe("FounderCta: el enlace lleva a /fundadoras y se puede clickear", () => {
  it("ambas variantes apuntan a /fundadoras (no a /for-residences)", () => {
    for (const variant of ["modal", "float"] as const) {
      const tag = anchorTag(render(variant));
      expect(tag).toContain('href="/fundadoras"');
    }
  });

  it("la tarjeta flotante declara pointer-events-auto (si no, hereda none del contenedor del popup y no recibe clics)", () => {
    const tag = anchorTag(render("float"));
    expect(tag).toContain("pointer-events-auto");
    // Al costado del popup solo desde 1100 px (600 + 20 + 340 + margen); más angosto se usa la compacta de adentro. Ya no flota fija.
    expect(tag).not.toMatch(/(^|[\s"])fixed([\s"]|$)/);
    expect(tag).toContain("min-[1100px]:grid");
    expect(anchorTag(render("modal"))).toContain("min-[1100px]:hidden");
  });

  it("dentro del popup real: el aside cuelga del contenedor pointer-events-none y el enlace lo compensa", () => {
    const html = renderToStaticMarkup(
      createElement(
        PreaperturaDialog,
        { labelledBy: "t", aside: createElement(FounderCta, { state: none, closure: open, variant: "float" }) } as ComponentProps<typeof PreaperturaDialog>,
        createElement("h1", { id: "t" }, "Hola"),
      ),
    );
    const wrapperStart = html.indexOf("pointer-events-none");
    expect(wrapperStart).toBeGreaterThan(-1); // el contenedor existe y bloquea los clics por defecto
    const anchorIndex = html.indexOf('href="/fundadoras"');
    expect(anchorIndex).toBeGreaterThan(wrapperStart); // la tarjeta está dentro del contenedor (y del focus trap)
    const tag = anchorTag(html.slice(html.lastIndexOf("<a ", anchorIndex)));
    expect(tag).toContain("pointer-events-auto");
  });

  it("muestra el cupo real: con 3+ residencias el medidor y «Quedan N de 15»; sin dato, texto fijo y sin medidor", () => {
    const counted = render("float", { kind: "counted", taken: 4, remaining: 11, hasExternal: true });
    expect(counted).toContain("Quedan");
    expect(counted).toContain("11 de 15");
    expect(counted).toContain('aria-label="Lugares de fundadora: 4 de 15 en proceso"');
    const unknown = render("float", { kind: "unknown" });
    expect(unknown).toContain("Solo 15 lugares");
    expect(unknown).not.toContain("en proceso\"");
    expect(unknown).toContain("Quiero ser fundadora");
  });

  const four = { kind: "counted", taken: 4, remaining: 11, hasExternal: true } as const;

  it("la compacta muestra marca, pregunta, cupo y los cuatro beneficios cortos (DR67)", () => {
    const html = render("modal", four);
    for (const t of ["Residencias fundadoras · Gratis", "¿Tenés una residencia?", "Perfil verificado", "Insignia fundadora", "Más arriba al abrir", "Premium 1.er año"]) {
      expect(html).toContain(t);
    }
    expect(html).not.toContain("Gratis para tu residencia.");
  });

  it("la lateral muestra la pregunta larga, los cinco beneficios y que es gratis", () => {
    const html = render("float", four);
    for (const t of [
      "¿Tenés una residencia en Buenos Aires?",
      "Te visitamos y armamos tu perfil con vos",
      "Perfil Verificado sin costo",
      "Insignia «Residencia fundadora»",
      "Aparecés más arriba al abrir",
      "Plan Premium bonificado el primer año",
      "Gratis para tu residencia.",
    ]) {
      expect(html).toContain(t);
    }
  });

  it("sin residencias en proceso no hay medidor", () => {
    expect(render("modal", { kind: "none" })).not.toContain("en proceso\"");
  });

  it("con la convocatoria cerrada no promete beneficios de fundadora ni muestra el cupo", () => {
    for (const variant of ["modal", "float"] as const) {
      const html = renderToStaticMarkup(createElement(FounderCta, { state: four, closure: { kind: "closed" }, variant }));
      expect(html).toContain("La convocatoria de Residencia fundadora cerró");
      expect(html).toContain("Sumar mi residencia");
      expect(html).not.toMatch(/Insignia|Premium|[Mm]ás arriba|Quedan|en proceso"/); // sin `i`: el ícono se llama «workspace_premium»
    }
  });
});

describe("PreaperturaDialog: lateral al lado y celular completo (DR67)", () => {
  function dialog(props: Partial<ComponentProps<typeof PreaperturaDialog>>) {
    return renderToStaticMarkup(
      createElement(PreaperturaDialog, { labelledBy: "t", ...props } as ComponentProps<typeof PreaperturaDialog>, createElement("h1", { id: "t" }, "Hola")),
    );
  }

  it("por defecto es una hoja inferior con manija", () => {
    const html = dialog({});
    expect(html).toContain("data-dialog-handle");
    expect(html).not.toContain("pre-full");
    expect(html).not.toContain("min-[1100px]:gap-5");
  });

  it("con `fullOnMobile` ocupa la pantalla en celular y no tiene manija", () => {
    const html = dialog({ fullOnMobile: true });
    expect(html).toContain("pre-full");
    expect(html).toContain("items-stretch");
    expect(html).not.toContain("data-dialog-handle");
  });

  it("con `asideBeside` la caja y la lateral van en fila desde 1100 px", () => {
    expect(dialog({ asideBeside: true })).toContain("min-[1100px]:gap-5");
  });
});
