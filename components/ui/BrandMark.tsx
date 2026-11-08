/**
 * Logo PROVISORIO de EstuRed (casa + R + cama). Un solo lugar para reemplazarlo cuando
 * se defina la marca: este componente + app/icon.svg + app/apple-icon.png + app/manifest.ts.
 * Concepto original compartido por el dueño, con el nombre cambiado a EstuRed.
 */
const INK = "#1d2722";
const SAND = "#c4ad8d";
const CREAM = "#fbf6ec";

type BrandMarkProps = {
  /** "symbol": solo el ícono; "horizontal": ícono + wordmark. */
  variant?: "symbol" | "horizontal";
  /** Lado del ícono en px. */
  size?: number;
  /** "dark" para fondos oscuros (footer): wordmark claro y ícono con tile crema. */
  tone?: "default" | "dark";
  /** Oculta el wordmark en pantallas chicas (variant horizontal). */
  hideTextOnMobile?: boolean;
  className?: string;
};

export function BrandSymbol({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className ?? ""}`}
    >
      <rect width="64" height="64" rx="15" fill={CREAM} />
      <g fill="none" stroke={INK} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27 50H14V25L32 11L50 25V37" />
        <path d="M28 25H37A7.5 7.5 0 0 1 37 40H33M36 40L48 52" />
      </g>
      <rect x="17" y="35" width="6" height="4.5" rx="2.2" fill={SAND} />
      <rect x="17" y="40" width="12" height="6" rx="1.6" fill={SAND} />
    </svg>
  );
}

export function BrandMark({
  variant = "horizontal",
  size = 32,
  tone = "default",
  hideTextOnMobile = false,
  className,
}: BrandMarkProps) {
  if (variant === "symbol") return <BrandSymbol size={size} className={className} />;
  const dark = tone === "dark";
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <BrandSymbol size={size} />
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
