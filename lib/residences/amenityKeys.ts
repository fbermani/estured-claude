/**
 * Claves de comparación de servicios y áreas comunes para /search. Las residencias cargan sus ítems a mano («Otro»), así
 * que el catálogo trae variantes de la misma cosa («Wifi», «WiFi», «WiFi de alta velocidad», «Cocina equipada»). Para que
 * el filtro no muestre opciones repetidas, cada etiqueta se reduce a una clave: minúsculas, sin tildes ni espacios de
 * más, y unas pocas equivalencias claras. Dos etiquetas con la misma clave son la misma opción.
 */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Equivalencias que no se resuelven solo normalizando (clave normalizada -> clave canónica). */
const ALIASES: Record<string, string> = {
  "wifi de alta velocidad": "wifi",
  internet: "wifi",
  // 0073: «Cocina» pasó a ser el área común «Cocina compartida»; las variantes viejas se funden en esa opción.
  cocina: "cocina compartida",
  "cocina equipada": "cocina compartida",
  lavadero: "lavanderia",
  "area de estudio": "sala de estudio",
  "limpieza semanal de areas comunes": "limpieza general",
};

export function amenityKey(label: string): string {
  const n = normalizeLabel(label);
  return ALIASES[n] ?? n;
}

/** Quita repetidos (por clave) conservando el orden y la primera etiqueta de cada clave. */
export function dedupeAmenities(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  return labels.filter((l) => {
    const k = amenityKey(l);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
