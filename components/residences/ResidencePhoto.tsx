import Image from "next/image";

/**
 * Foto de una residencia con estado "sin foto" de marca (Ciclo 54, D12).
 *
 * EstuRed no usa fotos de terceros: hasta que la residencia cargue las suyas
 * se muestra una placa tipográfica con el barrio en grande, con un tinte
 * (mint / butter / sky / lilac) estable por barrio (miniaturas: fachada ilustrada), para que el vacío se lea como decisión de diseño y
 * no como algo roto. El texto "Foto próximamente" aparece solo donde se pasa
 * `label` (catálogo, ficha); en miniaturas y paneles internos va sin texto.
 *
 * Llena a su contenedor: el padre define el tamaño y debe ser `relative`
 * (reserva el alto, así que no hay salto de layout al cargar la imagen).
 */

/** Tinte por barrio (mismo barrio, mismo color) con su color de texto; clases estáticas para Tailwind. */
const TINTS = [
  { bg: "bg-mint", fg: "text-forest-700" },
  { bg: "bg-butter", fg: "text-butter-fg" },
  { bg: "bg-sky", fg: "text-sky-fg" },
  { bg: "bg-lilac", fg: "text-lilac-fg" },
] as const;

function tintFor(seed: string): (typeof TINTS)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

/** Fachada con balcones — SVG propio, trazo en `currentColor` (forest-700). */
function FacadeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 180"
      fill="none"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Suelo */}
      <path d="M8 168h204" opacity=".55" />
      {/* Árbol de la vereda */}
      <path d="M26 168v-34" opacity=".7" />
      <circle cx="26" cy="118" r="17" fill="var(--color-forest-tint)" opacity=".9" />
      {/* Casa vecina, más baja */}
      <rect x="164" y="92" width="44" height="76" rx="3" fill="var(--color-paper)" opacity=".7" />
      <path d="M174 110h8M190 110h8M174 128h8M190 128h8" opacity=".55" />
      {/* Edificio principal */}
      <rect x="56" y="26" width="104" height="142" rx="4" fill="var(--color-paper)" />
      {/* Cornisa */}
      <path d="M50 26h116" strokeWidth="3" />
      <path d="M62 38h92" opacity=".45" />
      {/* Segundo piso: ventanas con balcón */}
      <rect x="70" y="50" width="26" height="32" rx="2" fill="var(--color-forest-tint)" />
      <rect x="120" y="50" width="26" height="32" rx="2" fill="var(--color-forest-tint)" />
      <path d="M83 50v32M70 66h26M133 50v32M120 66h26" opacity=".5" />
      <path d="M66 86h34M116 86h34" />
      <path d="M70 86v7M78 86v7M86 86v7M96 86v7M120 86v7M128 86v7M136 86v7M146 86v7" opacity=".55" />
      {/* Primer piso */}
      <rect x="70" y="104" width="26" height="32" rx="2" fill="var(--color-forest-tint)" />
      <rect x="120" y="104" width="26" height="32" rx="2" fill="var(--color-forest-tint)" />
      <path d="M83 104v32M70 120h26M133 104v32M120 120h26" opacity=".5" />
      {/* Puerta de entrada */}
      <path d="M99 168v-38a9 9 0 0 1 9-9h0a9 9 0 0 1 9 9v38" fill="var(--color-orange-tint)" />
      <path d="M108 121v47" opacity=".5" />
      <circle cx="112.5" cy="148" r="1.2" fill="currentColor" stroke="none" />
      <path d="M94 168h28" />
    </svg>
  );
}

export type ResidencePlaceholderVariant = "card" | "hero" | "thumb";

const ILLUSTRATION_SIZE: Record<ResidencePlaceholderVariant, string> = {
  card: "h-[84%] w-auto max-w-[92%]",
  hero: "h-[86%] w-auto max-w-[92%]",
  thumb: "h-[74%] w-auto max-w-[92%]",
};

export function ResidencePhotoPlaceholder({
  name,
  zone,
  variant = "card",
  label,
  className = "",
}: {
  name: string;
  zone?: string;
  variant?: ResidencePlaceholderVariant;
  /** Texto discreto ("Foto próximamente"). Sin `label` no se muestra ninguno. */
  label?: string;
  className?: string;
}) {
  const tint = tintFor(zone?.trim() || name);
  const plaque = variant !== "thumb";
  return (
    <div
      role="img"
      aria-label={label ? `${name}: ${label.toLowerCase()}` : `${name}: sin fotos cargadas`}
      className={`absolute inset-0 flex items-center justify-center overflow-hidden ${tint.bg} ${className}`}
    >
      {plaque ? (
        <>
          <span className="absolute -left-6 -top-8 size-28 rounded-full bg-paper/45" aria-hidden />
          <span className="absolute -bottom-10 -right-8 size-32 rounded-full bg-paper/35" aria-hidden />
          {/* Placa tipográfica (auditoría A5): el barrio en grande distingue las residencias sin foto. */}
          <div className={`relative flex max-w-[88%] flex-col items-center gap-1.5 text-center ${tint.fg}`}>
            {zone && (
              <span className={`font-display font-bold leading-tight ${variant === "hero" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-[26px]"}`}>
                {zone}
              </span>
            )}
            <span className="rounded-full bg-paper/80 px-2.5 py-1 text-xs font-semibold text-ink-soft">
              {label ?? "Foto próximamente"}
            </span>
          </div>
        </>
      ) : (
        <FacadeIllustration className={`relative ${tint.fg} opacity-70 ${ILLUSTRATION_SIZE[variant]}`} />
      )}
    </div>
  );
}

/**
 * Foto real si hay URL; si no, el placeholder de marca. El padre debe ser
 * `relative` y tener alto definido.
 */
export function ResidencePhoto({
  src,
  name,
  zone,
  alt,
  sizes,
  priority,
  variant = "card",
  label,
  imageClassName = "",
}: {
  src?: string | null;
  name: string;
  zone?: string;
  /** Alt de la imagen real; por defecto, "Foto de {name}". */
  alt?: string;
  sizes: string;
  priority?: boolean;
  variant?: ResidencePlaceholderVariant;
  label?: string;
  /** @deprecated sin efecto desde la placa tipográfica; se conserva para no romper llamadores. */
  labelPosition?: "top" | "bottom";
  imageClassName?: string;
}) {
  if (!src) return <ResidencePhotoPlaceholder name={name} zone={zone} variant={variant} label={label} />;
  return (
    <Image
      src={src}
      alt={alt ?? `Foto de ${name}${zone ? ` en ${zone}` : ""}`}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${imageClassName}`}
    />
  );
}
