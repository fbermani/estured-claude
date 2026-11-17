/**
 * Garantía estructural del requisito del dueño: en el hero el sello «Verificada» NO puede tapar el precio, el nombre ni la CTA en
 * ningún ancho (320 a 1440 px). Como el navegador no se puede abrir en CI, el test fija la ESTRUCTURA que lo hace imposible:
 * precio y sello viven en regiones distintas de la placa (`top` y `foot`), el sello es un hijo de flujo normal de su propia columna,
 * y no hay ningún elemento posicionado de forma absoluta dentro de la placa.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResidencePlate } from "@/components/residences/ficha/ResidencePlate";

const hero = (over: Partial<{ name: string; zone: string | null; fromPriceUsd: number | null }> = {}) =>
  renderToStaticMarkup(
    createElement(ResidencePlate, { variant: "hero", name: "Residencia Norte", zone: "Palermo", fromPriceUsd: 190, arsPerUsd: 1480, ...over }),
  );

/** Contenido de una región `data-plate-region="x"` (hasta el cierre de su div/span, suficiente para estas marcas planas). */
function region(html: string, name: string): string {
  const start = html.indexOf(`data-plate-region="${name}"`);
  expect(start, `falta la región ${name}`).toBeGreaterThan(-1);
  return html.slice(start);
}

describe("ResidencePlate hero: el sello no tapa el precio", () => {
  it("precio y sello están en regiones distintas, en orden (top, nombre, foot)", () => {
    const html = hero();
    const top = html.indexOf('data-plate-region="top"');
    const h1 = html.indexOf("<h1");
    const foot = html.indexOf('data-plate-region="foot"');
    const price = html.indexOf('data-plate-region="price"');
    const seal = html.indexOf('data-plate-region="seal"');
    expect(top).toBeGreaterThan(-1);
    expect(top).toBeLessThan(h1);
    expect(h1).toBeLessThan(foot);
    // el precio está dentro de «top» (antes del h1) y el sello dentro de «foot» (después del h1)
    expect(price).toBeGreaterThan(top);
    expect(price).toBeLessThan(h1);
    expect(seal).toBeGreaterThan(foot);
  });

  it("el precio con su referencia en ARS está en la región superior y el sello no", () => {
    const html = hero();
    const topHtml = html.slice(html.indexOf('data-plate-region="top"'), html.indexOf("<h1"));
    expect(topHtml).toContain("desde USD 190/mes");
    expect(topHtml).toContain("≈ ARS 281.000");
    expect(topHtml).not.toContain("<svg");
    const footHtml = region(html, "foot");
    expect(footHtml).not.toContain("desde USD");
  });

  it("ningún elemento de la placa se posiciona de forma absoluta (no hay superposición posible)", () => {
    // Única excepción: el tooltip de la «i» de la cotización (aparece solo al pasar el mouse o enfocar, abre hacia arriba, nunca sobre el sello).
    const html = hero().replace(/<span role="tooltip"[^>]*>.*?<\/span>/, "");
    expect(html).not.toMatch(/class="[^"]*(^|\s)(absolute|fixed)(\s|")/);
    expect(html).not.toMatch(/(^|\s)-?(top|left|right|bottom)-\[?-?\d/);
  });

  it("el sello escala con el ancho de la placa con un tope (clamp sobre cqw) y no se encoge fuera de su columna", () => {
    const html = hero();
    expect(html).toMatch(/data-plate-region="seal"[^>]*shrink-0/);
    expect(html).toMatch(/style="width:clamp\(5\.5rem, 15cqw, 7rem\)"/);
  });

  it("sin precio (sin tarifas cargadas) la placa sigue sin superponer nada", () => {
    const html = hero({ fromPriceUsd: null });
    expect(html).not.toContain('data-plate-region="price"');
    expect(html).toContain('data-plate-region="seal"');
  });

  it("el nombre es el único h1 y la moneda se escribe USD", () => {
    const html = hero();
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Residencia Norte");
    expect(html).not.toContain("US$");
  });

  it("un nombre muy largo no desborda: el tamaño se calcula con la palabra más larga y el texto se parte al ancho", () => {
    const html = hero({ name: "Residencia Universitaria Internacional San Telmo" });
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toMatch(/font-size:clamp\(1\.75rem, calc\(\(100cqw - 4\.25rem\) \/ /);
  });
});

describe("ResidencePlate panel y barra", () => {
  it("el panel lleva el nombre y el sello mini en regiones separadas", () => {
    const html = renderToStaticMarkup(createElement(ResidencePlate, { variant: "panel", name: "Residencia Norte", zone: "Palermo" }));
    expect(html.indexOf('data-plate-region="name"')).toBeLessThan(html.indexOf('data-plate-region="seal"'));
    expect(html).toContain("Palermo, verificada en persona");
  });

  it("la barra móvil muestra el precio «desde» en USD con su referencia en ARS", () => {
    const html = renderToStaticMarkup(createElement(ResidencePlate, { variant: "bar", fromPriceUsd: 190, arsPerUsd: 1480 }));
    expect(html).toContain("USD 190");
    expect(html).toContain("≈ ARS 281.000");
    expect(html).not.toContain("US$");
  });
});
