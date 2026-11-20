import { Icon } from "@/components/ui/Icon";

/**
 * Pastilla de opción (radio o casillero). Compacta de 34 px con 6 px de separación: EXCEPCIÓN aprobada por el dueño a la regla
 * interna de 44 px (DR42.5; cumple WCAG 2.5.8 AA de 24 px). El input real cubre la pastilla (clic y teclado nativos); el foco se ve
 * con un anillo de 3 px y el estado marcado no depende solo del color (tilde).
 */
export function ChoiceChip({
  type,
  name,
  value,
  checked,
  disabled,
  onChange,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex">
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border-[1.5px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 ease-fresh peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest-ink peer-disabled:opacity-50 ${
          checked ? "border-forest bg-forest-tint text-forest-700" : "border-line-2 bg-paper text-ink-soft"
        }`}
      >
        {checked && <Icon name="check" className="text-base" />}
        {children}
      </span>
    </label>
  );
}
