const AVATAR_STYLES = [
  "bg-forest-tint text-forest-700",
  "bg-orange-tint text-orange-700",
  "bg-mint text-forest-700",
  "bg-sand-100 text-ink-soft",
];

/**
 * Avatar de comunidad: inicial sobre un color rotativo y, si hay, la bandera del país en una chapita. Es el avatar de
 * `CommunityBrowser` extraído para compartirlo (p. ej. con las tarjetas de la preapertura) sin cargar el explorador entero.
 */
export function FlagAvatar({
  initial,
  flag,
  flagLabel,
  index = 0,
  size = "sm",
}: {
  initial: string;
  flag?: string | null;
  flagLabel?: string | null;
  index?: number;
  size?: "sm" | "lg";
}) {
  const style = AVATAR_STYLES[index % AVATAR_STYLES.length];
  const sizing = size === "lg" ? "h-24 w-24 text-3xl" : "h-10 w-10 text-sm";
  return (
    <div className="relative shrink-0">
      <div className={`flex items-center justify-center rounded-full font-bold ${style} ${sizing}`}>{initial}</div>
      {flag && (
        <span
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-paper shadow-sm ring-2 ring-paper ${
            size === "lg" ? "h-9 w-9 text-xl" : "h-6 w-6 text-base"
          }`}
          aria-label={flagLabel ?? undefined}
        >
          {flag}
        </span>
      )}
    </div>
  );
}
