import { Icon } from "@/components/ui/Icon";

/** Aviso discreto «Modo dev: cuenta de prueba»: solo aparece en desarrollo con una cuenta autogenerada (ver `lib/preapertura/devAccounts.ts`). */
export function DevAccountNotice({ email, className = "" }: { email?: string | null; className?: string }) {
  return (
    <p
      role="note"
      className={`inline-flex items-center gap-1.5 rounded-field border-[1.5px] border-dashed border-butter-fg bg-butter px-2.5 py-1 text-xs font-bold text-butter-fg ${className}`}
    >
      <Icon name="science" className="text-base" />
      Modo dev: cuenta de prueba{email ? `, ${email}` : ""}
    </p>
  );
}

/** Ayuda de desarrollo bajo el botón de envío: avisa que vacío crea una cuenta de prueba. Se oculta fuera de desarrollo. */
export function DevEmptyHint() {
  if (process.env.NODE_ENV !== "development") return null;
  return <p className="text-center text-xs text-ink-soft">Modo dev: enviá el formulario vacío para crear una cuenta de prueba.</p>;
}
