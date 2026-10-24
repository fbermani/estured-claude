import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { ChecklistItem, OnboardingBannerCopy, OnboardingTone } from "@/lib/residences/onboardingStatus";

const toneClasses: Record<OnboardingTone, string> = {
  info: "border-info-fg/30 bg-info-bg text-info-fg",
  warning: "border-warning-fg/30 bg-warning-bg text-warning-fg",
  danger: "border-danger-fg/30 bg-danger-bg text-danger-fg",
  success: "border-success-fg/30 bg-success-bg text-success-fg",
};

const stateIcon: Record<ChecklistItem["state"], { icon: string; cls: string; sr: string }> = {
  done: { icon: "check_circle", cls: "text-success-fg", sr: "Hecho" },
  in_progress: { icon: "pending", cls: "text-warning-fg", sr: "En curso" },
  todo: { icon: "radio_button_unchecked", cls: "text-ink-faint", sr: "Pendiente" },
};

/**
 * Banner de estado de una residencia en onboarding (Ciclo 65): qué pasa ahora,
 * qué se puede hacer mientras tanto y un checklist con estado real.
 */
export function OnboardingBanner({
  copy,
  checklist,
  residenceId,
}: {
  copy: OnboardingBannerCopy;
  checklist: ChecklistItem[];
  residenceId: string;
}) {
  return (
    <section
      aria-label="Estado de tu residencia"
      className={`mt-6 rounded-card border-[1.5px] p-4 sm:p-5 ${toneClasses[copy.tone]}`}
    >
      <div className="flex items-start gap-3">
        <Icon name={copy.icon} className="mt-0.5 shrink-0 text-2xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">{copy.title}</h2>
          <p className="mt-1 text-sm text-ink">{copy.now}</p>
          {copy.adminMessage && (
            <blockquote className="mt-2 whitespace-pre-line break-words rounded-field border-l-4 border-warning-fg/60 bg-paper px-3 py-2 text-sm text-ink">
              {copy.adminMessage}
            </blockquote>
          )}
          <p className="mt-2 text-sm text-ink-soft">{copy.meanwhile}</p>
          {copy.cta && (
            <Link
              href={`/residence/${residenceId}/${copy.cta.href}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-field bg-forest px-4 py-2 text-sm font-bold text-white hover:bg-forest-600"
            >
              {copy.cta.label}
              <Icon name="arrow_forward" className="text-base" />
            </Link>
          )}
        </div>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {checklist.map((item) => {
          const s = stateIcon[item.state];
          const content = (
            <>
              <Icon name={s.icon} className={`mt-0.5 shrink-0 text-xl ${s.cls}`} />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">
                  {item.label} <span className="sr-only">({s.sr})</span>
                </span>
                <span className="block break-words text-xs text-ink-soft">{item.detail}</span>
              </span>
            </>
          );
          const cls = "flex items-start gap-2 rounded-field bg-paper px-3 py-2.5";
          return (
            <li key={item.key}>
              {item.href && item.state !== "done" ? (
                <Link href={`/residence/${residenceId}/${item.href}`} className={`${cls} hover:bg-cream-2`}>
                  {content}
                </Link>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
