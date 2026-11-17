/**
 * Garantía estructural del requisito del dueño: en el hero el sello «Verificada» NO puede tapar el precio ni el nombre en ningún
 * ancho (320 a 1440 px). Como el navegador no se puede abrir en CI, el test fija la ESTRUCTURA que lo hace imposible: precio y sello
 * viven en columnas distintas de la placa (`main` y `seal`), el sello es un hijo de flujo normal de su propio carril, y no hay ningún
 * elemento posicionado de forma absoluta dentro de la placa. Además fija las medidas de la placa compacta y el contraste del texto
 * sobre el fondo semitransparente en el peor caso (foto casi blanca detrás).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResidencePlate } from "@/components/residences/ficha/ResidencePlate";
import { PLATE_SEAL_WIDTH } from "@/lib/residences/fichaHero";

const hero = (over: Partial<{ name: string; zone: string | null; fromPriceUsd: number | null }> = {}) =>
  renderToStaticMarkup(
    createElement(ResidencePlate, { variant: "hero", name: "Residencia Norte", zone: "Palermo", fromPriceUsd: 190, arsPerUsd: 1480, ...over }),
  );

describe("ResidencePlate hero: el sello no tapa el precio", () => {
  it("el sello vive en su propia columna, después de la columna principal (barrio, nombre y precio)", () => {
    const html = hero();
    const main = html.indexOf('data-plate-region="main"');
    const h1 = html.indexOf("<h1");
    const price = html.indexOf('data-plate-region="price"');
    const seal = html.indexOf('data-plate-region="seal"');
    expect(main).toBeGreaterThan(-1);
    // orden de jerarquía: nombre, después el precio, y recién al final el sello
    expect(main).toBeLessThan(h1);
    expect(h1).toBeLessThan(price);
    expect(price).toBeLessThan(seal);
    // el sello NO está adentro de la columna principal: la columna se cierra antes de que empiece el carril del sello
    const mainHtml = html.slice(main, seal);
    expect(mainHtml).not.toContain("<svg viewBox");
    expect(mainHtml.match(/<div/g)!.length).toBe(mainHtml.match(/<\/div>/g)!.length - 1);
  });

  it("el precio con su referencia en ARS está en su región y el sello no", () => {
    const html = hero();
    const priceHtml = html.slice(html.indexOf('data-plate-region="price"'), html.indexOf('data-plate-region="seal"'));
    expect(priceHtml).toContain("desde USD 190/mes");
    expect(priceHtml).toContain("≈ ARS 281.000");
    const sealHtml = html.slice(html.indexOf('data-plate-region="seal"'));
    expect(sealHtml).toContain("<svg");
    expect(sealHtml).not.toContain("desde USD");
  });

  it("ningún elemento de la placa se posiciona de forma absoluta (no hay superposición posible)", () => {
    // Única excepción: el tooltip de la «i» de la cotización (aparece solo al pasar el mouse o enfocar, nunca sobre el sello).
    const html = hero().replace(/<span role="tooltip"[^>]*>.*?<\/span>/, "");
    expect(html).not.toMatch(/class="[^"]*(^|\s)(absolute|fixed)(\s|")/);
    expect(html).not.toMatch(/(^|\s)-?(top|left|right|bottom)-\[?-?\d/);
  });

  it("el sello escala con el ancho de la placa con un tope (clamp sobre cqw) y no se encoge fuera de su columna", () => {
    const html = hero();
    expect(html).toMatch(/data-plate-region="seal"[^>]*shrink-0/);
    expect(html).toContain(`style="width:${PLATE_SEAL_WIDTH}"`);
    expect(PLATE_SEAL_WIDTH).toBe("clamp(3.75rem, 16cqw, 5rem)");
  });

  it("el hero ya no repite «la visitamos en persona»: queda solo el sello, con su nombre accesible", () => {
    const html = hero();
    expect(html).not.toContain("<strong");
    expect(html.replace(/aria-label="[^"]*"/g, "")).not.toContain("la visitamos en persona");
    expect(html).toMatch(/data-plate-region="seal"[^>]*role="img"[^>]*aria-label="Verificada por EstuRed: la visitamos en persona"/);
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
    expect(html).toContain("font-size:clamp(1.5rem, calc((100cqw - 4rem - clamp(3.75rem, 16cqw, 5rem)) / ");
  });
});

describe("ResidencePlate hero: placa compacta y semitransparente", () => {
  it("el ancho de la placa no pasa de 500 px y el nombre tiene un tope chico (40 px)", () => {
    const html = hero();
    expect(html).toMatch(/data-plate="hero"[^>]*max-w-\[500px\]/);
    expect(html).toMatch(/, 40px\);letter-spacing/);
    expect(html).not.toContain("max-w-[760px]");
  });

  it("el fondo es el token forest-ink al 80 % (sin literales) y no hay blur ni gradientes", () => {
    const html = hero();
    expect(html).toContain("bg-[color:var(--forest-ink-80)]");
    expect(html).not.toMatch(/backdrop-blur|gradient/);
  });
});

describe("contraste de la placa semitransparente (peor caso: foto blanca detrás)", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const rgba = (token: string): number[] => {
    const m = new RegExp(`${token}:\\s*rgb\\((\\d+) (\\d+) (\\d+) / ([\\d.]+)\\)`).exec(css);
    expect(m, `token ${token}`).not.toBeNull();
    return m!.slice(1, 5).map(Number);
  };
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  /** Mezcla `fg` (r, g, b, alfa) sobre un fondo opaco `bg` (r, g, b). */
  const over = (fg: number[], bg: number[]) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));

  const plateOnWhite = over(rgba("--forest-ink-80"), [255, 255, 255]);
  const paper = [255, 253, 248];

  it("el alfa del fondo de la placa es ~80 %", () => {
    expect(rgba("--forest-ink-80")[3]).toBeGreaterThanOrEqual(0.75);
    expect(rgba("--forest-ink-80")[3]).toBeLessThanOrEqual(0.85);
  });

  it("el texto principal (paper) da ≥ 4,5:1 sobre la placa aun con fondo blanco detrás", () => {
    expect(ratio(paper, plateOnWhite)).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto secundario (paper al 88 %) da ≥ 4,5:1 en el mismo peor caso", () => {
    const soft = over(rgba("--paper-88"), plateOnWhite);
    expect(ratio(soft, plateOnWhite)).toBeGreaterThanOrEqual(4.5);
  });

  it("el precio (forest-ink sobre el chip paper) da ≥ 4,5:1", () => {
    expect(ratio([12, 58, 44], paper)).toBeGreaterThanOrEqual(4.5);
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
