"use client";

import { useState } from "react";
import { PageHero } from "@/components/ui/PageHero";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { RegisterStudentForm } from "@/app/(public)/register/student/RegisterStudentForm";
import { RegisterFamilyForm } from "@/app/(public)/register/family/RegisterFamilyForm";
import { RegisterResidenceForm } from "@/app/(public)/register/residence/RegisterResidenceForm";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

type Role = "student" | "family" | "residence";

const ROLES: { id: Role; tone: RoleTone; icon: string; title: string; sub: string; includes: string[] }[] = [
  {
    id: "student",
    tone: "student",
    icon: "school",
    title: "Soy estudiante",
    sub: "Busco residencia en CABA",
    includes: ["Compará residencias verificadas", "Enviá solicitudes que quedan registradas (sujetas a confirmación)", "Tu apellido, fecha de nacimiento y universidad son privados"],
  },
  {
    id: "family",
    tone: "family",
    icon: "family_restroom",
    title: "Soy familiar",
    sub: "Acompaño a un estudiante",
    includes: ["Proponé opciones y seguí el proceso", "El estudiante aprueba el vínculo antes de que veas nada", "Soporte de EstuRed si algo no está claro"],
  },
  {
    id: "residence",
    tone: "residence",
    icon: "apartment",
    title: "Soy residencia",
    sub: "Quiero solicitar sumar mi residencia",
    includes: ["Primero te contacta el equipo de EstuRed", "Tu perfil se revisa antes de publicarse", "Perfil Verificado gratuito"],
  },
];

const HERO: Record<Role, { eyebrow: string; glyph: string; subtitle: string }> = {
  student: { eyebrow: "Bienvenida", glyph: "school", subtitle: "Elegí cómo vas a usar EstuRed. Después podés sumar otros vínculos." },
  family: { eyebrow: "Acompañá", glyph: "family_restroom", subtitle: "Creá tu cuenta y pedí vincularte. El estudiante aprueba antes de que veas nada." },
  residence: { eyebrow: "Sumá tu residencia", glyph: "apartment", subtitle: "Dejanos los datos principales de tu residencia. El equipo de EstuRed te contacta para coordinar; la cuenta se entrega después." },
};

/** Selector de rol (opción A de «Crear cuenta»): elegís quién sos y abajo aparece el formulario correspondiente, sin cambiar de pantalla. */
export function RolePicker({ residences }: { residences: { id: string; name: string; area: string | null }[] }) {
  const [role, setRole] = useState<Role>("student");
  const current = ROLES.find((r) => r.id === role)!;
  const hero = HERO[role];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8 sm:py-12">
      <PageHero tone={current.tone} eyebrow={hero.eyebrow} title="Creá tu cuenta" subtitle={hero.subtitle} glyph={hero.glyph} />

      <Card className="p-4 sm:p-5">
        <p className="mb-3 text-[13px] font-bold uppercase tracking-wider text-ink-faint">1 · ¿Quién sos?</p>
        <div role="radiogroup" aria-label="Tipo de cuenta" className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => {
            const selected = r.id === role;
            return (
              <label
                key={r.id}
                className={`${toneClass(r.tone)} relative flex min-h-11 cursor-pointer items-center gap-3 rounded-card border-2 p-3.5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-(--tone) hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--tone) sm:flex-col sm:text-center ${selected ? "border-(--tone) bg-(--tone-tint)" : "border-line bg-paper"}`}
              >
                <input type="radio" name="role" value={r.id} checked={selected} onChange={() => setRole(r.id)} className="sr-only" />
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${selected ? "bg-(--tone) text-white" : "bg-(--tone-tint) text-(--tone-700)"}`}>
                  <Icon name={r.icon} className="text-[26px]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold text-ink">{r.title}</span>
                  <span className="hidden text-[13px] text-ink-soft sm:block">{r.sub}</span>
                </span>
                {selected && <Icon name="check_circle" className="ml-auto text-xl text-(--tone) sm:absolute sm:right-2 sm:top-2 sm:ml-0" />}
              </label>
            );
          })}
        </div>
      </Card>

      <div className={toneClass(current.tone)}>
        <p className="mb-3 px-1 text-[13px] font-bold uppercase tracking-wider text-ink-faint">2 · Tus datos</p>
        <details className="mb-3 rounded-field border border-line bg-paper px-4 py-1">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink [&::marker]:text-(--tone)">
            <span className="ml-1">Qué incluye tu cuenta</span>
          </summary>
          <ul className="mb-3 list-disc space-y-1 pl-6 text-sm text-ink-soft">
            {current.includes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {role === "student" && (
            <div className="mb-3 rounded-field bg-cream-2 p-3 text-sm">
              <p className="mb-2 flex items-center gap-2 font-semibold text-ink">
                Así te ven otras personas
                <span className="rounded-full bg-butter px-2 py-0.5 text-[11px] font-bold text-butter-fg">Ejemplo</span>
              </p>
              <ul className="space-y-1.5 text-ink-soft">
                <li className="flex items-center gap-2"><Icon name="person" className="text-lg" /><b className="text-ink">Lucía R.</b> solo tu inicial</li>
                {["Apellido", "Fecha de nacimiento", "Universidad"].map((d) => (
                  <li key={d} className="flex items-center gap-2"><Icon name="lock" className="text-lg" />{d}<em className="ml-auto not-italic text-ink-faint">Privado</em></li>
                ))}
              </ul>
            </div>
          )}
        </details>
        {/* Los tres formularios quedan montados (solo se oculta el que no corresponde) para no perder lo escrito al cambiar de rol. */}
        <div hidden={role !== "student"}><RegisterStudentForm residences={residences} /></div>
        <div hidden={role !== "family"}><RegisterFamilyForm /></div>
        <div hidden={role !== "residence"}><RegisterResidenceForm /></div>
      </div>
    </div>
  );
}
