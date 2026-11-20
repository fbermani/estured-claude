import { Icon } from "@/components/ui/Icon";
import { FlagAvatar } from "@/components/residences/FlagAvatar";

/**
 * Tarjetas en vivo del paso 2 (SPEC pantalla 3). Presentacionales: reciben lo que el estudiante va completando. Lo vacío se muestra
 * en gris con un ejemplo de qué va ahí (nunca un dato inventado). La edad sale de la fecha de nacimiento del paso 1.
 */

function Ph({ children }: { children: React.ReactNode }) {
  return <span className="text-ink-faint">{children}</span>;
}

export type PreviewData = {
  name: string;
  age: number | null;
  /** Provincia (si es Argentina) o país. */
  from: string;
  flag: string;
  career: string;
  tags: string[];
  /** Para la tarjeta de búsqueda. */
  fromLong: string;
  roomType: "individual" | "shared" | "any" | "";
  university: string;
  entry: string;
};

const MONTHS: Record<string, string> = { "1": "enero", "2": "febrero", "3": "marzo", "4": "abril" };

export function ProfileCardLive({ data }: { data: PreviewData }) {
  return (
    <article className="grid gap-3 rounded-card border border-line bg-paper p-4 shadow-card">
      <div className="flex items-center gap-3">
        <FlagAvatar initial={data.name ? data.name[0].toUpperCase() : "?"} flag={data.flag || undefined} flagLabel={data.from || undefined} />
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight text-ink">{data.name || <Ph>Tu nombre</Ph>}</p>
          <p className="text-sm text-ink-soft">
            {data.age != null ? `${data.age} años` : "Edad"}, {data.from ? `de ${data.from}` : <Ph>de dónde sos</Ph>}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="school" className="text-lg text-forest-700" />
        {data.career || <Ph>Tu carrera</Ph>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {data.tags.length > 0 ? (
          data.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line bg-cream-2 px-2 py-1 text-xs font-semibold text-ink-soft">
              {tag}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-line px-2 py-1 text-xs text-ink-faint">Hábitos e intereses</span>
        )}
      </div>
    </article>
  );
}

function Row({ filled, icon, text, placeholder }: { filled: boolean; icon: string; text: string; placeholder: string }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${filled ? "font-semibold text-ink" : "text-ink-faint"}`}>
      <Icon name={icon} className={`text-lg ${filled ? "text-forest-700" : "text-line-2"}`} />
      {filled ? text : placeholder}
    </li>
  );
}

export function SearchCardLive({ data }: { data: PreviewData }) {
  const room =
    data.roomType === "any"
      ? "Cualquier tipo de habitación"
      : data.roomType === "individual"
        ? "Habitación individual"
        : data.roomType === "shared"
          ? "Habitación compartida"
          : "";
  const entry = data.entry === "unsure" ? "Fecha flexible" : data.entry ? `Desde ${MONTHS[data.entry] ?? ""}` : "";
  return (
    <article className="grid gap-2.5 rounded-card border border-line bg-paper p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-[38px] place-items-center rounded-full bg-orange-tint text-orange-700">
          <Icon name="travel_explore" className="text-xl" />
        </span>
        <div>
          <p className="font-display text-base font-bold leading-tight text-ink">Busca residencia</p>
          <p className="text-xs text-ink-faint">en Buenos Aires</p>
        </div>
      </div>
      <ul className="grid gap-1.5">
        <Row filled={Boolean(data.fromLong)} icon="location_on" text={`Viene de ${data.fromLong}`} placeholder="Viene de tu ciudad…" />
        <Row filled={Boolean(room)} icon="bed" text={room} placeholder="Habitación individual o compartida" />
        <Row filled={Boolean(data.university)} icon="school" text={`Cerca de ${data.university}`} placeholder="Cerca de tu universidad" />
        <Row filled={Boolean(entry)} icon="event" text={entry} placeholder="Desde enero, febrero, marzo…" />
      </ul>
    </article>
  );
}

/** Medidor de perfil: arranca en 10 % (la cuenta) y sube con cada dato. Se anima con `transform`, nunca con el ancho. */
export function ProfileMeter({ percent }: { percent: number }) {
  return (
    <div className="mt-3 flex items-center gap-2.5" aria-live="polite">
      <div
        role="progressbar"
        aria-label="Perfil completo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 flex-1 overflow-hidden rounded-full bg-cream-2"
      >
        <div
          className="h-full origin-left rounded-full bg-orange transition-transform duration-[400ms] ease-out-fresh motion-reduce:transition-none"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
      <b className="min-w-11 text-right font-display text-sm tabular-nums text-ink">{percent}%</b>
    </div>
  );
}
