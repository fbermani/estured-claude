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
        <p className="text-sm font-semibold uppercase tracking-wide text-sage-600 mb-2">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-bold text-petrol-800">{title}</h2>
      {description && (
        <p className="mt-3 text-base sm:text-lg text-ink-soft">{description}</p>
      )}
    </div>
  );
}
