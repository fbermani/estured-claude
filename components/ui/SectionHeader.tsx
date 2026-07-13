export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  const alignment = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl ${alignment} mb-10`}>
      {eyebrow && (
        <p className="text-sm font-extrabold uppercase tracking-wide text-forest-700 mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-bold text-ink">{title}</h2>
      {description && (
        <p className="mt-3 text-base sm:text-lg text-ink-soft">{description}</p>
      )}
    </div>
  );
}
