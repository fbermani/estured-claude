import { Icon } from "@/components/ui/Icon";
import { Inline } from "@/components/guides/Inline";
import type { GuideBlock, GuideSection } from "@/lib/guides/types";

function Blocks({ blocks, linkClass, textClass }: { blocks: GuideBlock[]; linkClass?: string; textClass: string }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return (
              <p key={i} className={`mt-4 text-[17px] leading-8 first:mt-0 ${textClass}`}>
                <Inline text={b.text} linkClass={linkClass} />
              </p>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`mt-4 grid gap-2 pl-6 text-[17px] leading-8 ${b.ordered ? "list-decimal" : "list-disc"} ${textClass}`}>
                {b.items.map((it, n) => (
                  <li key={n}>
                    <Inline text={it} linkClass={linkClass} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "checklist":
            return (
              <ul key={i} className="mt-4 grid gap-2.5">
                {b.items.map((it, n) => (
                  <li key={n} className="flex items-start gap-3 rounded-field bg-paper px-4 py-3 shadow-sm">
                    <span aria-hidden="true" className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-md border-2 border-forest bg-white text-forest">
                      <Icon name="check" className="text-base! opacity-0" />
                    </span>
                    <span className="text-[17px] leading-7 text-ink">
                      <Inline text={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "subheading":
            return (
              <h3 key={i} id={b.id} className="mt-6 scroll-mt-28 font-display text-xl font-bold text-ink">
                {b.text}
              </h3>
            );
          default:
            return null; // `embed`: reservado para herramientas futuras.
        }
      })}
    </>
  );
}

const CALLOUT: Record<string, { icon: string; box: string; icon_cls: string; text: string; link?: string }> = {
  checklist: { icon: "checklist", box: "border-forest/30 bg-forest-tint", icon_cls: "bg-forest text-white", text: "text-ink" },
  "next-step": { icon: "arrow_circle_right", box: "border-transparent bg-forest-ink", icon_cls: "bg-white/15 text-white", text: "text-white/90", link: "text-white" },
  idea: { icon: "lightbulb", box: "border-butter-fg/20 bg-butter", icon_cls: "bg-butter-fg text-white", text: "text-ink" },
  family: { icon: "family_restroom", box: "border-orange-700/20 bg-orange-tint", icon_cls: "bg-orange-700 text-white", text: "text-ink" },
};

/** Cuerpo de la guía: H2 + bloques; los encabezados convencionales se muestran como recuadros. */
export function GuideBody({ sections }: { sections: GuideSection[] }) {
  return (
    <>
      {sections.map((s) => {
        const c = CALLOUT[s.variant];
        if (!c) {
          return (
            <section key={s.id} aria-labelledby={s.id} className="mt-10 first:mt-0">
              <h2 id={s.id} className="scroll-mt-28 font-display text-2xl font-bold leading-tight text-ink sm:text-[1.75rem]">
                {s.heading}
              </h2>
              <div className="mt-3">
                <Blocks blocks={s.blocks} textClass="text-ink-soft" />
              </div>
            </section>
          );
        }
        const dark = s.variant === "next-step";
        return (
          <section key={s.id} aria-labelledby={s.id} className={`mt-10 rounded-card border-[1.5px] p-5 sm:p-7 ${c.box}`}>
            <div className="flex items-center gap-3">
              <span className={`flex size-10 flex-none items-center justify-center rounded-xl ${c.icon_cls}`}>
                <Icon name={c.icon} className="text-2xl!" />
              </span>
              <h2 id={s.id} className={`scroll-mt-28 font-display text-xl font-bold leading-tight sm:text-2xl ${dark ? "text-white" : "text-ink"}`}>
                {s.heading}
              </h2>
            </div>
            <div className="mt-4">
              <Blocks blocks={s.blocks} textClass={c.text} linkClass={c.link} />
            </div>
          </section>
        );
      })}
    </>
  );
}
