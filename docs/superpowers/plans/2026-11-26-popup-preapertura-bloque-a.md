# Popup de preapertura, bloque A: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar a la app el popup aprobado, 15 fundadoras, número desde 11 y perfil obligatorio.

**Architecture:** Cambios en `components/preapertura/*` y `lib/preapertura/*`. Una migración aditiva asigna el número en la base. El código funciona antes y después de la migración.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, Supabase, Vitest.

**Spec:** `docs/00_DECISION_LOG.md` DR67 y `docs/superpowers/specs/2026-11-26-popup-preapertura-mockup.html` (mockup aprobado el 2026-11-26).

**Skill de diseño:** `impeccable` para las tareas 4 a 8.

**Fuera de este plan:** registro sin contraseña, Google, canal mail o WhatsApp, mail de bienvenida (bloque B) y API de WhatsApp (bloque C).

## Global Constraints

- Copy en voseo, copiado exacto del mockup. «Soporte», nunca «mediación». Sin promesas de disponibilidad.
- Solo tokens de `app/globals.css`. No editar ese archivo. Estilos propios en `app/(preapertura)/preapertura.css`.
- Movimiento solo con `transform` y `opacity`, apagado con `prefers-reduced-motion`.
- Texto ≥ 12 px. Objetivos táctiles ≥ 44 px. Foco visible. Contraste ≥ 4,5:1. Sin mayúsculas en etiquetas.
- Sin scroll horizontal a 320 px.
- Cupo de fundadoras: **15**. El medidor muestra solo altas reales.
- Contador de estudiantes: desde **25** reales (`STUDENT_COUNTER_MIN`, sin cambios).
- Número de registro: desde **11**, solo estudiantes, fijo en la fila.
- Con algún perfil ficticio, el título es «Así vas a ver a tus posibles compañeros». «Se están sumando» solo con todo real.
- Validación de servidor en toda mutación.
- Árbol compartido: `git add` con rutas explícitas. Push solo a `staging`. Nunca a `main`.
- Migración: aplicarla en `estured-dev` (ref `gyfbtsuibmecefwovdgh`). Producción la aplica el dueño.
- Cada commit termina con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Decisiones de este plan (reversibles, para que el dueño las vete)

1. «Mi lugar» queda como la pantalla del mockup. Se van los 5 pasos, el carrusel y el panel punteado.
2. Con el perfil completo, el botón naranja pasa a ser el de Instagram.
3. Los ejemplos se apagan con **10** perfiles reales (antes 12). Las fichas muestran 2 etiquetas (antes 3).
4. Perfil obligatorio: nombre, país, universidad, carrera, mes de ingreso y habitación.
5. En celular el popup ocupa toda la pantalla. Con aviso de cookies, deja su espacio arriba.
6. Entre este bloque y el B, quien perdió la sesión ingresa por `/login`. El popup ya no lo enlaza.
7. El cartel de «Mi lugar» («Tu panel · se activa cuando abramos») queda hasta que el dueño decida.

## Review Focus

1. Aviso de cookies activo en celular: no tapa la banda ni los botones (tarea 6, paso 6).
2. Código publicado antes de la migración: «Mi lugar» carga sin número (tarea 2, test).
3. Estudiante registrado antes con perfil a medias: ve sus datos y los errores por campo (tarea 3, test).
4. Menor invitado: completa el perfil obligatorio sin activar la comunidad (tarea 3, test).
5. Navegador de Instagram en 360×600: el botón de fundadoras se ve sin desplazar (tarea 9, paso 4).
6. Perfil a medias que destilda la comunidad: la tarjeta desaparece aunque falten datos (tarea 3, test).

## Archivos

| Archivo | Responsabilidad en este bloque |
|---|---|
| `lib/preapertura/rules.ts` | Cupo 15, 10 ejemplos |
| `db/migrations/0111_preapertura_registration_number.sql` | Número desde 11 |
| `lib/preapertura/miLugar.ts` | Número y perfil completo |
| `lib/preapertura/validation.ts` | Campos obligatorios |
| `components/preapertura/MiniCommunityRail.tsx` | Fichas nuevas |
| `components/preapertura/FounderCta.tsx` | Tarjeta compacta y lateral |
| `components/preapertura/PreaperturaDialog.tsx` | Lateral al lado y celular completo |
| `components/preapertura/{LiveBand,BenefitList}.tsx` | Nuevos: banda y beneficios |
| `components/preapertura/EntryContent.tsx` | Popup nuevo |
| `components/preapertura/RoleTabs.tsx` | Nuevo: estudiante o familiar |
| `components/preapertura/MiLugarContent.tsx` | Registro listo |

---

### Task 1: Cupo de 15 fundadoras

**Files:**
- Modify: `lib/preapertura/rules.ts`, `components/preapertura/FounderMeter.tsx` (comentario), `app/(public)/register/residence/RegisterResidenceForm.tsx:52,61`, `lib/residenceSignup/confirmationEmail.ts:25,28`, `lib/preapertura/devScreens.ts:31`
- Test: `lib/preapertura/rules.test.ts`, `components/preapertura/FounderCta.test.ts`, `lib/residenceSignup/confirmationEmail.test.ts`

**Interfaces:**
- Produces: `FOUNDER_CAPACITY = 15`. Ningún texto escribe el número a mano.

- [ ] **Step 1: Actualizar los tests**

```ts
// rules.test.ts
expect(FOUNDER_CAPACITY).toBe(15);
expect(founderState({ externalSignups: 3, otherInVerification: 1 })).toEqual({ kind: "counted", taken: 4, remaining: 11, hasExternal: true });
expect(founderState({ externalSignups: 14, otherInVerification: 0 })).toEqual({ kind: "counted", taken: 14, remaining: 1, hasExternal: true });
expect(founderState({ externalSignups: 0, otherInVerification: 3 })).toEqual({ kind: "counted", taken: 3, remaining: 12, hasExternal: false });
expect(founderState({ externalSignups: 15, otherInVerification: 0 })).toEqual({ kind: "full" });
// FounderCta.test.ts
expect(counted).toContain("11 de 15");
expect(counted).toContain('aria-label="Lugares de fundadora: 4 de 15 en proceso"');
expect(unknown).toContain("Solo 15 lugares");
// confirmationEmail.test.ts
expect(buildResidenceConfirmationEmail({ ...base, place: "cupo" }).html).toContain("ocupa uno de los 15 lugares");
expect(buildResidenceConfirmationEmail({ ...base, place: "lleno" }).html).toContain("los 15 lugares están en proceso");
```

- [ ] **Step 2:** Run `npx vitest run lib/preapertura/rules.test.ts components/preapertura/FounderCta.test.ts lib/residenceSignup/confirmationEmail.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Cambiar la constante y reemplazar cada «10» por `FOUNDER_CAPACITY`.
- [ ] **Step 4:** Repetir el comando. Expected: PASS.
- [ ] **Step 5:** Commit «Preapertura: cupo de 15 residencias fundadoras (DR67)».

### Task 2: Número de registro desde 11

**Files:**
- Create: `db/migrations/0111_preapertura_registration_number.sql`, `lib/preapertura/miLugar.test.ts`
- Modify: `lib/preapertura/miLugar.ts`

**Interfaces:**
- Produces: `MiLugarData.registrationNumber: number | null`. Es `null` para familiares, cuentas sin fila o sin migración.

- [ ] **Step 1: Escribir el test** con un `admin` falso:

```ts
function fakeAdmin(replies: { data: unknown; error: { code: string } | null }[]) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => replies.shift()! };
  return { from: () => q } as unknown as SupabaseClient;
}
const studentRow = { role: "student", created_at: "2026-11-26T12:00:00Z", first_name: "Lu", country: "Chile", university: "UBA",
  career: "Derecho", entry_month: 3, entry_unsure: false, room_type: "any", habits: [], interests: [] };
it("devuelve el número guardado del estudiante", async () => {
  const data = await loadMiLugar(fakeAdmin([{ data: { ...studentRow, registration_number: 11 }, error: null }]), "u1");
  expect(data.registrationNumber).toBe(11);
});
it("sin la columna (0111 sin aplicar) carga igual, sin número", async () => {
  const data = await loadMiLugar(fakeAdmin([{ data: null, error: { code: "42703" } }, { data: studentRow, error: null }]), "u1");
  expect(data).toMatchObject({ role: "student", registrationNumber: null });
});
```

- [ ] **Step 2:** Run `npx vitest run lib/preapertura/miLugar.test.ts`. Expected: FAIL.
- [ ] **Step 3:** En `loadMiLugar`, pedir `registration_number`. Si `isMissingSchemaError(error)` (`lib/stayChange/schema`), repetir sin esa columna.
- [ ] **Step 4:** Repetir el comando. Expected: PASS.
- [ ] **Step 5: Crear la migración** (cabecera como `0080`, con «REVERTIR»):

```sql
begin;
alter table public.preapertura_estudiantes add column if not exists registration_number integer;
create sequence if not exists public.preapertura_registro_seq as integer start with 11 minvalue 11;
alter sequence public.preapertura_registro_seq owned by public.preapertura_estudiantes.registration_number;
revoke all on sequence public.preapertura_registro_seq from public, anon, authenticated;
grant usage, select on sequence public.preapertura_registro_seq to service_role;

do $$
declare r record;
begin
  for r in select id from public.preapertura_estudiantes
           where role = 'student' and registration_number is null order by created_at, id loop
    update public.preapertura_estudiantes
      set registration_number = nextval('public.preapertura_registro_seq') where id = r.id;
  end loop;
end $$;

create unique index if not exists preapertura_estudiantes_registration_number_key
  on public.preapertura_estudiantes (registration_number);

create or replace function public.preapertura_set_registration_number()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role = 'student' then
    new.registration_number := nextval('public.preapertura_registro_seq');
  else
    new.registration_number := null;
  end if;
  return new;
end $$;
revoke all on function public.preapertura_set_registration_number() from public, anon, authenticated;

drop trigger if exists preapertura_estudiantes_registration_number on public.preapertura_estudiantes;
create trigger preapertura_estudiantes_registration_number before insert on public.preapertura_estudiantes
  for each row execute function public.preapertura_set_registration_number();
commit;
```

Revertir: borrar trigger, función, índice y columna. La secuencia cae con la columna.

- [ ] **Step 6:** Aplicar en `estured-dev`. Confirmar el proyecto con `list_projects`.
- [ ] **Step 7: Verificar** en dev:

```sql
select min(registration_number), count(*) filter (where role='student' and registration_number is null) as sin_numero,
       count(*) filter (where role<>'student' and registration_number is not null) as familiares_con_numero
from public.preapertura_estudiantes;
```

Expected: `min` ≥ 11 (o nulo sin filas), 0 y 0.

- [ ] **Step 8:** Sumar a `preregistro/actions.test.ts`: un alta de estudiante queda con número ≥ 11. Correr ese archivo. Expected: PASS.
- [ ] **Step 9:** Commit «Preapertura: número de registro desde 11 (0111)». Puede haber huecos si un alta falla.

### Task 3: Perfil obligatorio

**Files:**
- Modify: `lib/preapertura/validation.ts`, `lib/preapertura/miLugar.ts`, `components/preapertura/ProfileForm.tsx`, `app/(preapertura)/preregistro/actions.ts`
- Test: `lib/preapertura/validation.test.ts`, `lib/preapertura/miLugar.test.ts`, `app/(preapertura)/preregistro/actions.test.ts`

**Interfaces:**
- Produces: `MiLugarData.profileComplete: boolean` (los 6 campos obligatorios; `entry_unsure` cuenta como mes).

- [ ] **Step 1: Escribir los tests.** Reemplazar «todo vacío es válido».

```ts
const complete = { first_name: "Lu", country: "Chile", university: "UBA", career: "Derecho", entry: "3", room_type: "any" };
it("sin los obligatorios marca cada campo", () => {
  const r = validateProfile({}, adult);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors).toEqual({
    first_name: "Completá tu nombre.", country: "Elegí tu país.", university: "Escribí tu universidad.",
    career: "Elegí tu carrera.", entry: "Elegí el mes de ingreso.", room_type: "Elegí el tipo de habitación.",
  });
});
it("hábitos, intereses y comunidad son opcionales", () => expect(validateProfile(complete, adult).ok).toBe(true));
it("«Todavía no sé» vale como mes", () => expect(validateProfile({ ...complete, entry: "unsure" }, adult).ok).toBe(true));
it("un menor completa el perfil y la comunidad queda apagada", () => {
  const r = validateProfile({ ...complete, community: "on" }, { isMinor: true, now: NOW });
  expect(r.ok && r.value.consentComunidad).toBe(false);
});
```

En `miLugar.test.ts`: fila completa da `profileComplete: true`; sin `university` da `false`.
Ajustar los tests existentes que mandan perfiles parciales: partir de `complete`.

En `actions.test.ts`, con la sesión simulada como el resto del archivo:

```ts
it("retirar la comunidad se guarda aunque falten obligatorios", async () => {
  // estudiante de prueba con consent_comunidad = true y perfil vacío
  const state = await saveProfile({ status: "idle" }, form({ first_name: "Lu" })); // sin `community`
  expect(state.status).toBe("error");
  expect(await communityConsentOf(userId)).toBe(false); // helper: lee `preapertura_estudiantes`
});
```

- [ ] **Step 2:** Run `npx vitest run lib/preapertura "app/(preapertura)/preregistro/actions.test.ts"`. Expected: FAIL en los nuevos.
- [ ] **Step 3:** Exigir los 6 campos. Un valor inválido conserva su mensaje actual. «Otra carrera» vacía conserva `career_other`.
- [ ] **Step 4: El retiro nunca se bloquea.** En `saveProfile`: si la fila tenía la comunidad activa y el envío llega sin `community`, guardar `consent_comunidad = false` antes de validar el resto. Registrar el consentimiento y la auditoría, y llamar `revalidateTag` y `revalidatePath` como hoy. Después devolver los errores de campo si faltan datos (DR44, Ley 25.326).
- [ ] **Step 5:** En `ProfileForm`: título «Completá tu perfil»; texto «Lo necesitamos para mostrarte residencias que te sirvan.»; nota «Hábitos, intereses y aparecer en la comunidad son opcionales.»; botón «Guardar mi perfil»; borrar «Lo completo después»; marcar `required`.
- [ ] **Step 6:** Repetir el comando del paso 2. Expected: PASS.
- [ ] **Step 7:** Commit «Preapertura: perfil obligatorio (DR67)».

### Task 4: Carrusel con fichas nuevas

**Files:**
- Modify: `lib/preapertura/rules.ts`, `lib/preapertura/communityRail.ts`, `components/preapertura/MiniCommunityRail.tsx`, `components/residences/FlagAvatar.tsx`
- Test: `lib/preapertura/communityRail.test.ts`, `lib/preapertura/rules.test.ts`

**Interfaces:**
- Produces: `railTitle(hasExamples: boolean): string` en `communityRail.ts`; `FlagAvatar size?: "sm" | "md" | "lg"` (`md`: círculo de 48 px).

- [ ] **Step 1: Escribir los tests**

```ts
expect(EXAMPLE_PROFILES).toHaveLength(10);
expect(EXAMPLES_OFF_AT).toBe(10);
expect(examplesToShow(4)).toBe(6);
expect(examplesToShow(10)).toBe(0);
expect(railTitle(true)).toBe("Así vas a ver a tus posibles compañeros");
expect(railTitle(false)).toBe("Se están sumando");
expect(toRailCard(adultRow, 0, NOW)!.tags).toEqual(["Madrugo", "Lectura"]);
```

- [ ] **Step 2:** Run `npx vitest run lib/preapertura`. Expected: FAIL.
- [ ] **Step 3:** Sumar a `EXAMPLE_PROFILES`: Bruno, 20, Brasil, Diseño Gráfico; Camila, 19, Chile, Economía; Diego, 23, Bolivia, Odontología; Sofía, 18, Ecuador, Veterinaria; Mateo, 21, Argentina, Contador Público. Etiquetas según el mockup. Usar valores de `lib/preapertura/options.ts`; si una carrera no existe, elegir la más cercana de la lista. `MAX_TAGS = 2`.
- [ ] **Step 4:** `CommunityCard`: 244 px, avatar `md`, nombre 17 px, borde sólido, sin cinta «Ejemplo». `aria-label` de la tira = `railTitle(hasExamples)`.
- [ ] **Step 5:** Repetir el comando. Expected: PASS.
- [ ] **Step 6:** Commit «Preapertura: carrusel de 10 perfiles con título de vista previa».

### Task 5: Tarjeta de fundadoras

**Files:**
- Modify: `components/preapertura/FounderCta.tsx`, `components/preapertura/PreaperturaDialog.tsx`, `components/preapertura/PreaperturaStage.tsx`, `app/(preapertura)/preapertura.css`
- Test: `components/preapertura/FounderCta.test.ts`

**Interfaces:**
- Produces: `FounderCta` con las mismas props. `PreaperturaDialog asideBeside?: boolean` y `fullOnMobile?: boolean`; `PreaperturaStage` los reenvía.

- [ ] **Step 1: Reescribir los tests de disposición**

```ts
const four = { kind: "counted", taken: 4, remaining: 11, hasExternal: true } as const;
expect(anchorTag(render("float"))).toContain("pointer-events-auto");
expect(anchorTag(render("float"))).toContain("min-[1100px]:grid");
expect(anchorTag(render("modal"))).toContain("min-[1100px]:hidden");
for (const t of ["Residencias fundadoras · Gratis", "¿Tenés una residencia?", "Perfil verificado", "Insignia fundadora", "Más arriba al abrir", "Premium 1.er año"])
  expect(render("modal", four)).toContain(t);
for (const t of ["¿Tenés una residencia en Buenos Aires?", "Te visitamos y armamos tu perfil con vos", "Perfil Verificado sin costo", "Insignia «Residencia fundadora»", "Aparecés más arriba al abrir", "Plan Premium bonificado el primer año"])
  expect(render("float", four)).toContain(t);
expect(render("modal", { kind: "none" })).not.toContain("en proceso\"");
```

- [ ] **Step 2:** Run `npx vitest run components/preapertura/FounderCta.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implementar las dos variantes como el mockup. Estados sin medidor conservan sus frases actuales. Con `counted`: «Quedan **11 de 15** lugares» (la lateral suma «Gratis para tu residencia.»). Cerrada: texto actual.
- [ ] **Step 4:** Con `asideBeside`, desde 1100 px (600 + 20 + 340 + 96 de margen) la caja y la lateral van en fila, centradas, separadas 20 px. La lateral mide 340 px y no es `fixed`. Halo con `transform` y `opacity`.
- [ ] **Step 5:** Repetir el comando. Expected: PASS.
- [ ] **Step 6:** Commit «Preapertura: tarjeta de fundadoras compacta y lateral».

### Task 6: Popup de entrada

**Files:**
- Create: `components/preapertura/LiveBand.tsx`, `components/preapertura/BenefitList.tsx`, `components/preapertura/EntryContent.test.ts`
- Modify: `components/preapertura/EntryContent.tsx`, `components/preapertura/LiveCount.tsx`, `app/(preapertura)/preapertura/page.tsx`, `app/(preapertura)/preapertura.css`
- Delete: `components/preapertura/FreeBadge.tsx`

**Interfaces:**
- Consumes: `railTitle`, `FounderCta`, `LegalLinks`, `asideBeside`, `fullOnMobile`.
- Produces: `LiveBand({ children }: { children: ReactNode })`; `BENEFITS: readonly { icon: string; label: string }[]` y `BenefitList({ variant }: { variant: "tiles" | "ticks" })`.

`BENEFITS`, en orden: `verified` «Residencias verificadas en persona»; `receipt_long` «Reglas y costos claros»; `groups` «Conocé la comunidad antes de elegir».

- [ ] **Step 1: Escribir el test** (`vi.mock` de `communityRailData` con `buildRail([])`; render de `await EntryContent(...)`):

```ts
for (const t of ["Acceso anticipado abierto", "Muy pronto:", "Encontrá y reservá tu residencia en Buenos Aires,", "con la seguridad de elegir bien.", "enterate primero", "Reglas y costos claros", "Conocé la comunidad antes de elegir", "Quiero enterarme primero", "Gratis. Sin tarjeta.", "Así vas a ver a tus posibles compañeros", "Términos"]) expect(html).toContain(t);
for (const t of ["Ingresá", "Soy familiar", "Sumarte es gratis", "Sumarme gratis", "Sé de los primeros", "Se están sumando"]) expect(html).not.toContain(t);
expect(html.indexOf('href="/fundadoras"')).toBeLessThan(html.indexOf("Así vas a ver"));
// con counter { kind: "number", count: 26 }
expect(html).toContain("estudiantes ya se sumaron");
```

- [ ] **Step 2:** Run `npx vitest run components/preapertura/EntryContent.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implementar en este orden: banda, marca sin enlace de ingreso, `h1#pre-h1`, `p#pre-sub` (frase larga «Estamos visitando residencias una por una.» y «Sumate y enterate primero cuáles quedaron verificadas.»), beneficios, botón dentro de `SignedInEntryCta`, «Gratis. Sin tarjeta.», contador, fundadoras `modal`, carrusel, legales. `LiveCount` no dibuja nada si `kind === "first"`. El punto «en vivo» solo con `hasExamples` falso.
- [ ] **Step 4:** CSS con ganchos `pre-*`: banda con brillo y anillo; `<mark>` con tokens `butter` y `gold`. Alturas bajas, valores del mockup: `(max-width:639px) and (max-height:700px)` oculta marca, frase larga e íconos; `(min-width:640px) and (max-height:830px)` compacta.
- [ ] **Step 5:** La página pasa `asideBeside` y `fullOnMobile`. En celular completo no hay manija. El botón «Cerrar (solo dev)» queda dentro de la pantalla. Regla: `body:has([data-cookie-notice])` deja 82 px arriba.
- [ ] **Step 6:** Verificar el aviso de cookies: en el navegador, insertar un `section[data-cookie-notice]` fijo de 60 px. Expected: la banda queda debajo.
- [ ] **Step 7:** Repetir el test. Expected: PASS.
- [ ] **Step 8:** Commit «Preapertura: popup de entrada nuevo (DR67)».

### Task 7: Paso 1 y registro familiar

**Files:**
- Create: `components/preapertura/RoleTabs.tsx`
- Modify: `components/preapertura/Step1Form.tsx`, `components/preapertura/FamilyForm.tsx`, `components/preapertura/UrgencyPanel.tsx`, `app/(preapertura)/preregistro/page.tsx`

**Interfaces:**
- Consumes: `BenefitList`.
- Produces: `RoleTabs({ current }: { current: "student" | "family" })`: dos enlaces («Soy estudiante» → `/preregistro`, «Soy familiar» → `/preregistro/familiar`) con `aria-current="page"`. `UrgencyPanel()` sin props.

- [ ] **Step 1:** `Step1Form`: `RoleTabs` sobre el formulario (no con invitación); título «Sumate en un minuto»; quitar «Paso 1 de 2» y el enlace inferior de familiar; botón «Sumarme».
- [ ] **Step 2:** `FamilyForm`: sumar `RoleTabs current="family"`.
- [ ] **Step 3:** `UrgencyPanel`: solo desde 860 px. Título actual, `BenefitList variant="ticks"` y «Gratis. Sin tarjeta.». Sin número ni carrusel. La página deja de llamar `getStudentCount`.
- [ ] **Step 4:** Run `npm run typecheck && npx eslint components/preapertura "app/(preapertura)"`. Expected: sin errores.
- [ ] **Step 5:** Commit «Preapertura: selector estudiante o familiar y panel sin número».

### Task 8: Registro listo

**Files:**
- Modify: `components/preapertura/MiLugarContent.tsx`, `app/(preapertura)/mi-lugar/page.tsx`, `app/(preapertura)/preregistro/actions.ts`, `lib/preapertura/counts.ts`, `lib/constants/contact.ts`
- Create: `components/preapertura/MiLugarContent.test.ts`
- Test: `app/(preapertura)/preregistro/actions.test.ts`

**Interfaces:**
- Consumes: `LiveBand`, `registrationNumber`, `profileComplete`.
- Produces: `INSTAGRAM_URL = "https://instagram.com/estured.residencias"`; `MiLugarContent({ data, devAccount })`.

- [ ] **Step 1: Escribir los tests**

```ts
const student: MiLugarData = { role: "student", firstName: "Lu", createdAt: "2026-11-26T12:00:00Z", profilePercent: 40,
  profileComplete: false, registrationNumber: 11, invitation: null };
// `html` = renderToStaticMarkup(createElement(MiLugarContent, { data: student }))
// estudiante, número 11, perfil incompleto
for (const t of ["¡Listo! Ya estás adentro", "Tu número de registro", ">11<", "¿Y ahora?", "Completar mi perfil", "Seguir @estured.residencias"]) expect(html).toContain(t);
expect(html.indexOf("Completar mi perfil")).toBeLessThan(html.indexOf("Seguinos en Instagram."));
expect(html).not.toContain("persona en sumarse");
// perfil completo: sin «Completar mi perfil», con «Editar mi perfil»
// familiar: invitación visible, sin número ni «Completar mi perfil»
// registrationNumber null: sin «Tu número de registro»
// actions.test.ts
expect(state.redirectTo).toBe("/mi-lugar");
```

- [ ] **Step 2:** Run `npx vitest run components/preapertura/MiLugarContent.test.ts "app/(preapertura)/preregistro/actions.test.ts"`. Expected: FAIL.
- [ ] **Step 3:** Implementar como el mockup. Pasos: «Seguinos en Instagram. Mostramos las visitas.» y «Esperá el aviso. Te escribimos apenas abramos.». No decir que se envió un mensaje: eso llega en el bloque B. Un solo botón naranja. Pie: «Editar mi perfil» (si está completo), «Salir», Términos y Privacidad.
- [ ] **Step 4:** El paso 1 redirige a `/mi-lugar`. Borrar `getStudentPosition` y el carrusel de la página.
- [ ] **Step 5:** Repetir el comando. Expected: PASS.
- [ ] **Step 6:** Commit «Preapertura: pantalla de registro listo con número y perfil».

### Task 9: Validar, publicar en staging y documentar

**Files:**
- Modify: `MEMORY.md`, `docs/NEXT_STEPS.md`, `docs/PLAN_SALIDA_PRODUCCION.md`, `docs/23_PREAPERTURA.md`, `docs/00_DECISION_LOG.md`

- [ ] **Step 1:** Run `npm run typecheck && npm run lint && npx vitest run lib/preapertura components/preapertura lib/residenceSignup "app/(preapertura)"`. Expected: verde.
- [ ] **Step 2:** Actualizar docs. En el runbook: 0111 pendiente en prod y su [SQL Editor](https://supabase.com/dashboard/project/hioscbefryufsbypsmtx/sql/new).
- [ ] **Step 3:** Commit. Correr `tsc` y `npm run build` sobre ese commit en un worktree limpio. Push a `staging`.
- [ ] **Step 4:** En `estured.vercel.app/preapertura`, capturar 360×600, 375×600, 1024×768, 1366×760. Expected: botón de fundadoras visible en celular; a 1024 la tarjeta va dentro del popup; a 1366 va al costado; sin scroll horizontal a 320.
- [ ] **Step 5:** Recorrer en staging: alta → número → perfil → «Mi lugar».
- [ ] **Step 6:** Pedir revisión con el agente o skill de revisión sobre el rango de commits.
- [ ] **Step 7: Antes de producción, pedir al dueño:** autorización para `main`; aplicar 0111; confirmar que existe `@estured.residencias`.
