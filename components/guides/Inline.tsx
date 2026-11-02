import Link from "next/link";
import type { ReactNode } from "react";

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Resuelve **negrita** y [enlaces](url) dentro de un texto de guía. Externos: pestaña nueva con rel noopener. */
export function Inline({ text, linkClass = "" }: { text: string; linkClass?: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else {
      const href = m[3];
      const cls = `font-semibold underline decoration-1 underline-offset-[3px] hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest rounded-sm ${linkClass || "text-forest-700"}`;
      out.push(
        /^https?:\/\//.test(href) ? (
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={cls}>
            {m[2]}
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        ) : !href.startsWith("/") ? (
          m[2]
        ) : (
          <Link key={key++} href={href} className={cls}>
            {m[2]}
          </Link>
        ),
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
