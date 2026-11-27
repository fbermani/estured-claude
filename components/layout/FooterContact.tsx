import { Icon } from "@/components/ui/Icon";
import { CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/constants/contact";

const contactLink =
  "inline-flex min-h-11 items-center gap-2 rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:min-h-8";

/** Instagram y email, compartidos por el footer público y el de preapertura. */
export function FooterContact({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-col text-sm text-white/80 ${className}`}>
      <li>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={contactLink}>
          {/* Material Symbols no trae logos de marcas: el de Instagram va dibujado. */}
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false" className="shrink-0 text-amber-soft-300">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" stroke="none" />
          </svg>
          <span className="sr-only">Instagram: </span>
          {INSTAGRAM_HANDLE}
        </a>
      </li>
      <li>
        <a href={`mailto:${CONTACT_EMAIL}`} className={contactLink}>
          <Icon name="mail" className="text-amber-soft-300" style={{ fontSize: 20 }} />
          <span className="sr-only">Contacto: </span>
          {CONTACT_EMAIL}
        </a>
      </li>
    </ul>
  );
}
