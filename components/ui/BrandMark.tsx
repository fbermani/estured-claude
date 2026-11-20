import Image from "next/image";

/**
 * Logo DEFINITIVO de EstuRed: casa + R + cama (vectorizado, 2026-11-11).
 * Fuente única: `marketing/instagram/assets/logo/`; las copias que usa la web viven en `public/brand/`
 * (`estured-icon.svg` con tile crema, `estured-mark.svg` / `estured-mark-crema.svg` marca sola, recortada).
 * Para cambiarlo: reemplazar esos archivos + `app/icon.svg` + `app/apple-icon.png` + `public/icon-*.png`.
 *
 * Recursos derivados del logo (viñeta, glifo, divisor) más abajo: úsenlos con medida —
 * la marca ya está en el header, la barra lateral y el footer; el resto son toques puntuales.
 */

type BrandMarkProps = {
  /** "symbol": solo el ícono; "horizontal": ícono + wordmark. */
  variant?: "symbol" | "horizontal";
  /** Lado del ícono en px. */
  size?: number;
  /** "dark" para fondos oscuros (footer): wordmark y marca claros. */
  tone?: "default" | "dark";
  /** Oculta el wordmark en pantallas chicas (variant horizontal). */
  hideTextOnMobile?: boolean;
  /** Dibuja el símbolo como ícono de app (marca sobre tile crema). Pensado para sellos grandes. */
  tile?: boolean;
  className?: string;
};

/**
 * Símbolo del logo. Por defecto es la marca sola (más presencia a tamaños chicos: header, barras laterales);
 * `tile` lo dibuja como ícono de app (marca sobre tile crema), para sellos grandes (login, 404).
 * `tone="dark"`: marca crema para fondos oscuros.
 */
export function BrandSymbol({
  size = 32,
  tone = "default",
  tile = false,
  className,
}: {
  size?: number;
  tone?: "default" | "dark";
  tile?: boolean;
  className?: string;
}) {
  if (tile) {
    return (
      <Image
        src="/brand/estured-icon.svg"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        unoptimized
        loading="eager"
        className={`shrink-0 ${className ?? ""}`}
      />
    );
  }
  return <BrandGlyph size={size} tone={tone === "dark" ? "cream" : "ink"} className={className} />;
}

/**
 * Marca sola (sin tile) para usar como sello o marca de agua. `tone="ink"` sobre fondos claros,
 * `tone="cream"` sobre fondos oscuros. Es decorativa: el nombre ya está en el texto cercano.
 */
export function BrandGlyph({
  size = 48,
  tone = "ink",
  className,
}: {
  size?: number;
  tone?: "ink" | "cream";
  className?: string;
}) {
  return (
    <Image
      src={tone === "cream" ? "/brand/estured-mark-crema.svg" : "/brand/estured-mark.svg"}
      alt=""
      aria-hidden="true"
      width={Math.round(size * (338 / 346))}
      height={size}
      unoptimized
      loading="eager"
      className={`shrink-0 ${className ?? ""}`}
    />
  );
}

export function BrandMark({
  variant = "horizontal",
  size = 32,
  tone = "default",
  hideTextOnMobile = false,
  tile = false,
  className,
}: BrandMarkProps) {
  if (variant === "symbol") return <BrandSymbol size={size} tone={tone} tile={tile} className={className} />;
  const dark = tone === "dark";
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandSymbol size={size} tone={tone} tile={tile} />
      <span
        aria-hidden="true"
        className={`font-display font-bold tracking-tight ${hideTextOnMobile ? "hidden sm:inline" : ""} ${dark ? "text-white" : "text-ink"}`}
        style={{ fontSize: Math.round(size * 0.68) }}
      >
        Estu<span className={dark ? "text-white/60" : "text-ink-faint"}>Red</span>
      </span>
    </span>
  );
}

/**
 * Viñeta de marca: la casa del logo con la cama dentro. Toma el color del texto (`currentColor`),
 * así que se tiñe con `text-forest`, `text-ink-faint`, etc. Para listas de beneficios o pasos
 * donde un ✓ genérico no aporta; no para checklists que el usuario tilda (esas llevan checkbox).
 */
export function BrandBullet({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className ?? ""}`}
    >
      <path
        d="M4.5 20V10.5L12 4.5l7.5 6V15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7.5" y="13.2" width="9" height="3.6" rx="1.4" fill="currentColor" opacity=".55" />
    </svg>
  );
}

/** Lista corta con la viñeta de marca. `items` son textos; el color de la viñeta es el del texto del contenedor. */
export function BrandList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={`grid gap-1.5 ${className ?? ""}`}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2">
          <BrandBullet size={18} className="mt-0.5 opacity-70" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Techo del logo como remate de sección: línea – casa – línea. Decorativo (`role="presentation"`). */
export function BrandDivider({ className }: { className?: string }) {
  return (
    <div role="presentation" className={`flex items-center gap-3 text-line-2 ${className ?? ""}`}>
      <span className="h-px flex-1 bg-current" />
      <BrandBullet size={22} className="text-ink-faint" />
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}
