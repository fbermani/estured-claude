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
    expect(tag).toContain("fixed");
    // Solo desde 1280 px: más angosto se solaparía con el popup centrado y ahí se usa la variante del final del popup.
    expect(tag).toContain("min-[1280px]:grid");
    expect(anchorTag(render("modal"))).toContain("min-[1280px]:hidden");
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

  it("muestra el cupo real: con 3+ residencias el medidor y «Quedan N de 10»; sin dato, texto fijo y sin medidor", () => {
    const counted = render("float", { kind: "counted", taken: 4, remaining: 6, hasExternal: true });
    expect(counted).toContain("Quedan");
    expect(counted).toContain("6 de 10");
    expect(counted).toContain('aria-label="Lugares de fundadora: 4 de 10 en proceso"');
    const unknown = render("float", { kind: "unknown" });
    expect(unknown).toContain("Solo 10 lugares");
    expect(unknown).not.toContain("en proceso\"");
    expect(unknown).toContain("Quiero ser fundadora");
  });
});
