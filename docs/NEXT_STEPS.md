# NEXT_STEPS.md

# EstuRed — Próximos pasos

## DR63: cobro de la reserva a la residencia y medios del fee — 2026-11-20

Estado: Fase 0 hecha (solo docs, sin código ni migración). Decisión y pendientes: `docs/00` DR63. Reglas: `docs/03` §12.1; estados: `docs/04` §5.8, §6; datos: `docs/06` §8.8, §11.1, §12.1; acciones: `docs/07` §16.3 a §16.7; pantallas: `docs/08` §6.7, §7.2, §7.8.

**Antes de la Fase 1, el dueño decide (DR63 (j)):**
1. Salida si la residencia nunca confirma tras «Ya pagué» (propuesta: alerta al admin a las 72 horas) y qué hace «No recibí el pago».
2. Contacto de la residencia visible al estudiante en el camino B (campo nuevo propuesto, obligatorio con B).
3. Si el staff puede leer `instructions_snapshot` (hoy SELECT por tabla lo permitiría).
4. Rótulo del camino A. La doc usa «Cobro con medios habilitados».
5. Si el cambio de datos de cobro exige aprobación del admin.
6. Fee: si «Ya pagué» detiene el vencimiento de `pending_manual_payment` (choca con DR8 (4)).

**Plan de fases (residencia):**
1. **BD:** migración 0102 (enum `student_reported_paid`, columnas de `residences`, `application_requests` y `external_residence_payments`, tabla `residence_collection_accounts` con RLS sin policies, `grant select (col)` por 0081) y catálogo `lib/payments/paymentMethods.ts`.
2. **Ficha «Cobro de la reserva»:** sección solo del dueño, validación server-side, auditoría con CBU enmascarado, requisito 10 en `lib/residences/submitReadiness.ts`.
3. **Solicitud del estudiante:** muestra cómo se cobrará, preferencia opcional, aviso de seguridad.
4. **Residencia acepta:** camino A o B, monto y medio precargados, datos congelados al habilitar el pago.
5. **Estudiante paga:** «Ya pagué», tarjeta con datos y botón «Copiar», contacto de la residencia en el camino B, ajuste del job de vencimiento.
6. **Aviso y cierre:** aviso a la residencia (in-app y push DR61), recordatorios de 24 h y 12 h, tests, seeds de demo y prueba en staging.

**Pista 2, fee EstuRed** (supuestos reversibles, `docs/00` DR63 (i)): mismas seis fases con tabla propia de medios del fee (separada de la de la residencia), medios elegidos por el admin, pagador que elige el medio, «Ya pagué» con comprobante obligatorio (DR8 sin cambios) y monto en USD con el tipo de cambio del `snapshot_final`. Empieza cuando el dueño cierre el punto 6.

### Opciones para conversar con residencias pioneras (DR63 (h), no se implementan)

- Medio fuera del catálogo.
- Monto distinto según el medio.
- Comisión del medio a cargo del estudiante.
- Varias cuentas por medio.
- Seña en vez del monto completo.
- Pago en efectivo al llegar (hoy no cabe: el fee exige «Pago recibido» antes de la reserva).
- Descartado: que EstuRed cobre por la residencia, porque implicaría custodia de fondos.

## Requisitos para enviar a revisión (DR59) — 2026-11-20

Hecho (sin build ni verificación visual): `computeSubmitReadiness` (`lib/residences/submitReadiness.ts`) con 9 requisitos + depósito y salida anticipada condicionales; el servidor lo recalcula en `saveResidenceProfile` solo con `submit` en `draft`/`needs_changes`/`verification_expired`; la tarjeta «Fortaleza del Perfil» muestra la checklist en vivo. **Pendiente:** (1) correr `scripts/seed-dev-fichas-completas.mjs --dry-run` y después aplicar en dev (deja las demo `verified_active` cumpliendo los requisitos y una en borrador que no); (2) `faq/actions.ts` debería hacer `revalidatePath(`/residence/${id}/profile`)` tras guardar preguntas (hoy el perfil refresca al volver a cargarse); (3) el Panel (`app/residence/[residence_id]/page.tsx`) todavía usa `computeProfileStrength` clásico: migrarlo a `strengthFromReadiness` para que el % coincida; (4) verificar en staging el rechazo del envío y el mensaje.

## Fase 5 de la ficha: compartir por WhatsApp, FAQ destacadas y foto principal — 2026-11-17

Hecho (sin verificar en navegador; ver `docs/00` DR57): `/residence/[id]/share` («Compartir ficha» en el sidebar), `lib/share/*` (plantilla, validación, resolución, `wa.me`), hoja `ShareFichaSheetServer` (`components/share/`), selección de FAQ destacadas en `/residence/[id]/faq` y botón «Principal» en las fotos del perfil. **Pendiente:** (1) aplicar 0095, 0096 y 0097 en `estured-dev` ANTES de pushear (runbook en `docs/PLAN_SALIDA_PRODUCCION.md`) y correr `scripts/seed-demo-share-featured.mjs`; (2) HECHO (sin verificar en navegador): franja `OwnerShareBar` sobre el hero de la ficha (solo equipo de esa residencia), tarjeta «Compartí tu ficha por WhatsApp» en el Panel, etiqueta «Nuevo» en el sidebar hasta `SHARE_NEW_UNTIL` (`lib/share/newBadge.ts`) y `?ref=wa` en el link del mensaje (la ficha lo ignora; se ve en los logs de Vercel, sin analytics propios); (4) las 5 FAQ fijas del perfil no se pueden destacar (son un jsonb); decidir si se migran al catálogo.

## Auditoría UX por recorrido Codex — 2026-11-14

Informe compartible: [`AUDITORIA_UX_RECORRIDO_CODEX_2026-11-14.md`](audits/AUDITORIA_UX_RECORRIDO_CODEX_2026-11-14.md). Siete demos y visitante; 12 hallazgos (2 P1, 8 P2, 2 P3), con capturas, criterios de aceptación y [cobertura explícita](archive/evidence/ux-2026-11-14/COBERTURA.md). No se implementaron fixes.

- Primero **UX01**: corregir la ayuda que dice que la dirección es privada aunque se publica; **UX02**: búsqueda/paginación de Comunidad admin (hoy corta en 300 y no permite llegar a Norte/Río).
- Luego contadores/listas, preguntas pendientes, orientación del perfil, revisión económica de solicitud y cambios enviados a aprobación. Reproducir con datos actuales antes de editar: hubo tests/commits concurrentes en dev.
- Para completar los estados no recorridos: casos demo vigentes de solicitud/renovación/espera, menor con vínculo estable y staff limitado. Typecheck/build OK; lint global con 7 errores en `docs/archive/evidence/2026-11-14/repro-actions.cjs`, no modificado por esta auditoría UX.

## DR48: documentos de estudiantes visibles para la residencia — 2026-11-14

- Implementado (acción `lib/documents/requestResidenceDocumentAccess.ts`, UI en Residentes y en el detalle de la solicitud con pago habilitado). Migración **0087** aplicada en dev vía MCP; en prod entra con el bootstrap.
- Pendiente: verificación visual en staging (dueño, staff con y sin casillero) y, si se quiere, una vista admin del registro `residence_document_access_log`.

## Auditoría de seguridad en dev — 2026-11-14

Informe: `docs/audits/AUDITORIA_SEGURIDAD_2026-11-14.md`. Tres medios sin corregir: **SEG14-01** (no reactivar fee de renovación vencido), **SEG14-02** (revalidar residencia publicada al convertir propuesta familiar) y **SEG14-03/B4** (cuota acumulada y rate limit de documentos). Sin críticos/altos confirmados en el alcance revisado; quedan límites de verificación explícitos en el informe. Antes de beta, implementar MFA obligatorio para admin/superadmin conforme docs/11 y docs/18. La revisión no modifica el estado de migraciones ni aprueba producción.

## Pendientes tras el hardening de seguridad (2026-11-12)
Detalle en `docs/audits/PLAN_SEGURIDAD_2026-11-12.md` ("Estado al 2026-11-12").
- Pasar la CSP de Report-Only a enforce tras observar los reportes (M5).
- Turnstile (M6, opción A, implementado): "Allow new users to sign up" ya apagado en dev (verificado); falta apagarlo en prod y cargar las claves reales en Vercel prod (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).
- Verificación de email (decidido 2026-11-12, opción C): la preapertura sigue creando cuentas con `email_confirm: true`; antes del lanzamiento público hay que exigir email verificado (link por mail) antes de solicitudes, pagos o contacto con residencias. Requisito de lanzamiento, no de preapertura.
- "Leaked password protection": requiere plan Pro (dev está en Free, no aplica); activarlo en prod cuando pase a Pro. JWT: queda en 1 h (default), sin cambios.
- Vercel prod: `NEXT_PUBLIC_APP_URL` obligatorio (`getAppUrl` lanza si falta), `DEMO_*` ausentes en Production y Preview, `CRON_SECRET`; crear el secreto `cron_secret` en Supabase Vault antes del bootstrap de prod.

## Preapertura — Fase 3 implementada 2026-11-08 (sin commit)

**Hecho (pasos 6 y 7 + legales):** `/mi-lugar` final (celebración, #N real, panel blureado «se activa cuando abramos», 5 pasos, carrusel «Se siguen sumando»; variantes perfil incompleto, familiar con invitación esperando/vencida/vinculados y cuenta sin fila; pie «Editar mi perfil»/«Salir»). Carrusel público REAL en entrada, paso 1, fondo blureado y Mi lugar (`communityRail.ts` puro + `communityRailData.ts` con service role y lista blanca de columnas; caché de datos con etiqueta `preapertura-community` que `saveProfile` invalida junto con `/preapertura`, `/` y `/for-students`). `/fundadoras` (medidor de cupo real, `Countdown` solo con `FOUNDERS_CLOSE_AT`, estados 0 / 1–2 / 3–9 / 10 / cerrado) y el CTA de la entrada apunta ahí. `/register/residence`: 5 datos obligatorios (nombre de la residencia, `address`, responsable, teléfono, email), misma validación en cliente y servidor (`validateSignupFields`), éxito con lugar de fundadora según el cupo de ANTES de guardar, mail de confirmación (`lib/residenceSignup/confirmationEmail.ts`, solo con preapertura encendida, degrada sin Resend) y, con flag, reescritura a `/fundadoras/datos` (popup). Legales: `/consentimientos` (líneas del flujo + Términos de la preapertura con la opción C y la comunidad + política) y la misma sección en `/terms` y `/privacy` solo con flag; los casilleros enlazan ahí (pestaña nueva). Sin migración nueva.
**Decisiones/supuestos reversibles (ratificar o ajustar):**
- Ejemplos del carrusel: pozo de 5; cada perfil real retira uno (se apagan a los 5 reales); `EXAMPLES_OFF_AT = 12` queda como tope duro (`rules.ts`). Con menos de 4 tarjetas la tira queda quieta.
- Invitación familiar (revisión de seguridad): el token NUNCA vuelve al familiar (ni en pantalla ni en la respuesta); sale solo por mail al email del invitado, que no se puede cambiar al canjear. Sin proveedor de mail (o si el envío falla) en producción no se emite invitación: se deshace el alta y se muestra «No pudimos enviar la invitación, probá más tarde». Solo con `NODE_ENV=development` se muestra el link copiable. El familiar declara «Soy mayor de 18 años» (validado en servidor). Mi lugar no tiene «Copiar link».
- `/register/residence` con flag: los campos opcionales (Instagram, camas) no se piden (diseño v4); sin flag siguen opcionales. Dirección válida = 5–200 caracteres con al menos una letra.
- Si el código sale antes que la 0080, el alta cae al esquema viejo (dirección guardada en `neighborhood`): el formulario nunca se rompe. Igual conviene aplicar 0080 antes de desplegar.
- La política NO menciona Sin Fronteras; contacto de privacidad = `CONTACT_EMAIL`; «cerrar cuenta» y «desactivar la opción C» se piden por mail (no hay botón en Mi lugar, a diferencia del borrador).
**Para encender `PREAPERTURA=on` en producción (checklist):**
1. Aplicar `db/migrations/0080_preapertura.sql` en prod (SQL Editor https://supabase.com/dashboard/project/mrwooskdcnkbitkhcvbf/sql/new, pegar el archivo) y regenerar el bootstrap de prod (`node scripts/build-bootstrap.mjs prod`) si se arma de cero. Hacerlo ANTES de desplegar este código.
2. Env de Vercel: `PREAPERTURA=on`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY` + `EMAIL_FROM` con dominio verificado (los mails de invitación y de confirmación de residencias salen solo con eso), `SUPABASE_SERVICE_ROLE_KEY`. Opcional: `FOUNDERS_CLOSE_AT` (ISO 8601); sin ella no hay cuenta regresiva.
3. Datos del responsable legal de la política de privacidad (hoy `[Responsable: a definir]` y `[Fecha a definir]` en `LegalPreapertura.tsx`) y revisión de un abogado (Ley 25.326; riesgo asumido por el dueño). Confirmar plazos de baja (30 días) y casilla de contacto.
4. Regla WAF de Vercel (rate limit) sobre `/preregistro`, `/preregistro/familiar`, `/register/residence` y `/fundadoras/datos`: los frenos de la app (IP y email) son en memoria y por instancia; el WAF cubre el resto, incluida la enumeración de cuentas por el mensaje «Ya hay una cuenta con ese email».
5. Decidir: fecha de cierre de fundadoras, plazo de contacto a residencias, duración de la insignia, Instagram en el formulario, vencimiento/reenvío de la invitación familiar (docs/23 §9).
6. Probar de punta a punta en un deploy de preview con el flag encendido y mails reales (aún no probado el mail con dominio Resend verificado).
**Dev (feedback 2):** el fondo del popup es la home real COMPLETA (Navbar + `HomeLanding` + Footer reales, solo escenografía inert; si cambia la home, cambia el fondo; las rutas `(preapertura)` no dibujan header/footer propios, así que no hay duplicados). Navegador flotante «Pantallas (dev)» (arriba a la izquierda) para recorrer las 13 pantallas con su sesión de prueba; `/register/residence` vacío en dev crea una solicitud `test-resi-*` (el seed `--borrar` las limpia junto con `test-preap-*`). Nada de esto existe en producción (el build elimina el navegador; la ruta de preparar da 404).
**Dev (feedback del dueño):** `node --env-file=.env.local scripts/seed-preapertura-dev.mjs [--apply] [--many] [--borrar]` deja datos para ver todas las pantallas (ver cabecera del script). Enviar vacío el paso 1 o `/preregistro/familiar` en desarrollo crea una cuenta de prueba (`test-preap-*`; `--borrar` las limpia). En producción nunca.
**Revisión de seguridad Fases 1–3 (2026-11-08, sin commit):** (A) invitación solo por mail, sin token en la respuesta, familiar declara 18+; (B) con flag, `/register/student` y `/register/family` redirigen a `/preregistro` y `/preregistro/familiar` y sus acciones (`registerStudent`, `registerFamily`) se cortan en el servidor (incluye el flujo de invitaciones de residencias DR19, que no opera en preapertura); `/register/residence` no se toca; (C) el menor invitado no da la opción C (ni consentimiento registrado ni `consent_c`) ni la comunidad; (D) cupo de fundadoras con conteos exactos (`head: true`); (E) el carrusel solo muestra valores de listas cerradas («Otra» si la carrera es libre); (F) asunto del mail sin `\r\n` y con el nombre acotado a 80, y freno por email (hash) aparte del de IP en `/register/residence`; (G) `Referrer-Policy: no-referrer` en `/preregistro` (lleva `?invitacion=`).
**Riesgos aceptados (decididos por el dueño):** (1) el paso 1 crea la cuenta con `email_confirm: true` (el mail no se verifica: fricción mínima); alguien puede registrarse con un mail ajeno. (2) el mensaje «Ya hay una cuenta con ese email» permite enumerar cuentas; se cubre con el WAF. (3) `/register/residence` exige `address` también con el flag apagado (DR46.4); **la 0080 debe aplicarse en prod ANTES de desplegar**, porque el fallback pre-0080 guarda la dirección en `neighborhood`.
**Falta / fuera de alcance:** tabla `preapertura_interesados`, cierre de cuenta desde Mi lugar, desactivar la opción C desde el perfil, código DR32 de verificación del mail del familiar (se pide al abrir), apagar el flag al abrir (quitar rewrites y volver a la landing real).

## Preapertura — Fase 2 implementada 2026-11-08 (sin commit)

**Hecho (pasos 4 y 5):** `/preregistro` (paso 1, `Step1Form`/`UrgencyPanel`), `/preregistro/perfil` (paso 2, `ProfileForm`, también sirve para «Editar mi perfil»), `/preregistro/familiar` (`FamilyForm`), `/mi-lugar` mínimo (confirma, #N real, editar perfil, salir) y `/students/*` → `/mi-lugar` (solo con flag). Lógica en `lib/preapertura/` (`validation`, `options`, `accounts`, `invitations`, `throttle`, `formState`); acciones en `app/(preapertura)/preregistro/actions.ts` y `familiar/actions.ts`. Avatar extraído a `components/residences/FlagAvatar.tsx` (lo usa también `CommunityBrowser`).
**Decisiones/supuestos reversibles (documentar en docs si el dueño los ratifica):**
- Sin selector de rol en el paso 1: el rol sale de la ruta (`/preregistro` = estudiante, `/preregistro/familiar` = familiar), como en el mockup v4. Sin Google (DR26).
- `student_profiles` y `family_members` exigen nombre/apellido (NOT NULL): se crean con `''` y el nombre de pila se completa en el paso 2 (se copia a `student_profiles.first_name`); apellido y relación familiar se piden al abrir. El familiar queda con `relationship_type = 'familiar'`.
- Menores: sin invitación, cualquier edad <18 no crea cuenta; con invitación, 14 a 17 entra (mismo piso de 14 del registro de siempre), `is_minor = true`, comunidad bloqueada. Edad con calendario de Buenos Aires (`ageByBirthDate`).
- Invitación familiar: una por familiar (unique), vence a los 30 días, solo se guarda el hash del token, sin reenvío ni recordatorios. (Superado: ver «Revisión de seguridad» arriba; el link ya no se muestra en producción.) Se manda por mail con Resend si hay clave (en sandbox solo llega al dueño de la cuenta). El mail usa `SITE_URL` (nunca el Host del pedido). Al canjearla se crea `family_links` en `pending_student_approval` (el familiar no aprueba ni consiente por el estudiante). No se manda el código DR32 de verificación del mail del familiar: queda para la apertura.
- Consentimientos: el casillero único guarda `terms`, `privacy` y `search_visibility_to_verified_residences` (opción C); la comunidad pública guarda `preapertura_community` con `granted` cada vez que cambia. La comunidad vive solo en `preapertura_estudiantes.consent_comunidad` (no toca `student_visibility_settings`).
- Año de ingreso: `entry_month`/`entry_year` (próxima temporada); «Todavía no sé» = `entry_unsure`.
- React 19 resetea los formularios con `action={fn}` y desmarcaba casilleros/pastillas controlados: los tres formularios usan `onSubmit` + `startTransition`.
- Al crear la cuenta la pantalla se re-renderiza con sesión: por eso los formularios muestran «Ya estás adentro» con sesión en vez de redirigir desde el servidor (si no, se perdía el paso 2 y el link de la invitación).
**Falta (actualizado Fase 3):** lo de Fase 3 quedó hecho (ver arriba); sigue pendiente `preapertura_interesados`, WAF de Vercel sobre `/preregistro` (el rate limit es en memoria) y probar el mail de invitación con dominio Resend verificado.

## Preapertura — Fase 1 implementada 2026-11-08 (sin commit)

**Hecho:** paso 2 (flag + `app/(preapertura)/` + rewrites/redirects + header/footer), paso 3 (`PreaperturaDialog`, `BlurredPreview`, entrada `/` con contador y cupo reales) y la migración **`db/migrations/0080_preapertura.sql`** (escrita, **NO aplicada**). **Parcial del paso 1:** la migración agrega `address` (y deja `neighborhood` nullable), pero el formulario `/register/residence` todavía pide barrio: ajustarlo (5 campos obligatorios, validación de servidor) recién después de aplicar 0080 en dev, porque el insert con `address` falla sin la columna. Stubs navegables: `/preregistro`, `/preregistro/familiar`, `/mi-lugar` (Fase 2). Falta: `/students/*` → Mi lugar con el flag, tabla `preapertura_interesados` (DR42 no define sus datos), tests de integración del cupo contra datos reales.
Ver el flag: `PREAPERTURA=on` en `.env.local` (reiniciar el dev server); en la pantalla de entrada, «Cerrar (solo dev)» muestra la landing sin blur.

## Preapertura — 2026-11-08 (plan original)

Doc: `docs/23_PREAPERTURA.md`; decisiones DR42–DR47. Orden sugerido (cada paso chico y verificable; migraciones con links dev/prod):
1. Migración: columna de dirección en `residence_signup_requests` + tablas de preinscriptos/interesados; ajustar `/register/residence` (5 campos obligatorios).
2. Flag `PREAPERTURA` + `app/(preapertura)/` con header/footer, rewrites/redirects en `next.config` (`/guias` intacto).
3. `PreaperturaDialog` + `BlurredPreview` y entrada `/` con contador real.
4. Paso 1 (18+ en servidor, términos con opción C) y bloqueo de menores con derivación a familiar.
5. Paso 2 con tarjetas en vivo; registro familiar con invitación.
6. «Mi lugar» y carrusel público (ejemplos rotulados, retiro progresivo).
7. Fundadoras: medidor de cupo real (10), cuenta regresiva, pantalla de éxito y email.
8. Tests acotados + `typecheck`/`lint`/`build`; revisión visual contra los HTML v4.
Antes de implementar: definir fecha de cierre y el resto de pendientes de `docs/23` §9.

## Motion video — 2026-11-05

**Actualización Launch v3:** ya se analizó la grabación de referencia y se crearon `EstuRed-Launch-16x9`/`9x16`: 71,27 segundos, narración argentina, subtítulos, música original 128 BPM, interfaces desktop/mobile y personajes vectoriales. Revisar estas composiciones en Studio (puerto 3100); no hay MP4 nuevo. Guion y tiempos en `video/src/launch/story.json`. Se mantienen las versiones anteriores.

Storyboard aprobado e implementado en las nuevas composiciones `EstuRed-Motion-*` (proyecto `video`). Previsualizar las versiones horizontal y vertical en Remotion Studio; revisar narrativa, ritmo y música original con el dueño. Lint/TypeScript y bundle de video OK; ocho cuadros por formato generados. No se exportó un MP4 nuevo. La referencia de YouTube sigue pendiente de cotejo visual. Detalles en `video/README.md`.

**Fecha:** 2026-07-06 (actualizado tras el Ciclo 2 — calidad visual y UX)

> **Nota (2026-07-08):** este archivo quedó desactualizado como bitácora operativa desde el Ciclo 3 en adelante — `MEMORY.md` es la fuente de verdad viva del estado del proyecto (leer siempre `MEMORY.md` §13/§13bis/§13ter/§13cuater para el historial de ciclos 3-8, y §14 para el plan de continuidad vigente). Este archivo se conserva por su valor histórico del arranque del proyecto (Ciclo 0-2).

---

## Actualización 2026-11-03: config de residencia (DR33–DR34)

Hecho y sin pushear: amenidades (0073), galería por secciones (0074), disponibilidad por tipo+género (0075), cambio de habitación (0076). Dev aplicado hasta 0076 (a 2026-11-03; vigente en `MEMORY.md` §3); prod vía bootstrap nuevo (regenerar). Próximo: explicación del cobro de mes vacío; verificar el lado estudiante del cambio de habitación (necesita un usuario con estadía activa); investigar `stayChange.test.ts`.
**Sin commit (2026-11-03):** cambio de habitación del estudiante verificado (Camila); galería verificada con subida real (Norte) y pendientes de seguridad de la subida; checklist de llegada 44 ítems con 10 esenciales (DR35). Detalle en `MEMORY.md` §2.

## TRASPASO a otro perfil (2026-11-02, al cierre de la sesión principal)

**Leer primero:** este bloque, `MEMORY.md` y `CLAUDE.md`. Todo lo hecho está commiteado en `main`, **nada pusheado** (no pushear salvo pedido del dueño).

**Estado git:** últimos commits locales: `34dae20` (DR32: verificación del mail del familiar, migración 0072), `54d59fe` y `d8c359e` (DR32 tutor, migración 0071), `1ddd76b` (guías published), `895aa67`, `bf5ade2`, `db8c15e`, `ca59ae0`/`a0d6b01` (DR30 ficha). Sesión de la ficha: terminada. Sesión del tutor (DR32): terminada y todo commiteado (`git status` limpio salvo untracked). Aun así, revisar `git status` al empezar.

**Migraciones:** dev aplicado hasta **0072** (0071 y 0072 aplicadas en dev). **Prod: pendientes 0068–0072** y deben entrar al bootstrap (`node scripts/build-bootstrap.mjs prod`). Ojo: hasta aplicar la 0072 en prod, ningún estudiante puede aprobar vínculos familiares nuevos allí. Siempre dar al dueño los links del SQL Editor (dev https://supabase.com/dashboard/project/gyfbtsuibmecefwovdgh/sql/new , prod https://supabase.com/dashboard/project/mrwooskdcnkbitkhcvbf/sql/new) + el archivo a pegar.

**DR32 resuelto (2026-11-02):** el familiar verifica su mail con código antes de que el estudiante apruebe el vínculo (0072). **Residual aceptado por el dueño:** un menor con acceso a dos mails puede hacerse pasar por su tutor (responsabilidad declarada; revisión legal anotada en `GAPS.md`). Sigue sin cooldown de reintentos tras rechazo del tutor (anotado). Para probar en dev: registrar un familiar en `/register/family`; con Resend en sandbox el código solo llega al dueño de la cuenta de Resend, así que si no es el mail del dueño no se recibe. Seed demo: `node --env-file=.env.local scripts/seed-demo-guardian-confirmation.mjs` (Valentina + Martín).

**Pendientes del dueño (no del código):** aplicar migraciones en prod; `NEXT_PUBLIC_SITE_URL` real en Vercel (local queda); dominio Resend verificado + `EMAIL_DOMAIN_VERIFIED=true` + clave Resend en Vercel (aún no hay dominio); regla WAF en Vercel; `CRON_SECRET`; proyecto Supabase prod; logo final; revisar ~11 expresiones dudosas en `design-proposals/guias-2026-11-02/reporte-editorial.md` (opcional).

**Candidatos para seguir (en este orden):** (1) probar el flujo del tutor y del mail en el navegador (no verificado); (2) regenerar el prototipo HTML compartible (solo datos ficticios; la ficha cambió con DR30); (3) fixes admin menores (enlace «Ir a Revocaciones →» de 18 px, botón de ediciones de perfil que se parte en dos líneas, primera fila resaltada sin `?id`); (4) probar en dispositivo táctil real; (5) auditoría final con el agente `auditor` (siempre última). Opcional: limpiar datos demo (`[DEMO-NEG]`, `[demo:seed-profile-edits]`; los seeds tienen `--delete`).

**Flujo de trabajo vigente:** docs primero para reglas de negocio → agente (`constructor`/`interfaz`/`base-datos`) → `revisor` (+ `seguridad` si toca seguridad) → parar dev server (pestaña de Terminal), matar :3000, `rm -rf .next`, typecheck + lint + UN build → commit local con trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` → relanzar `npm run dev`. Agentes en paralelo nunca buildean ni tocan el dev server. Tests acotados a lo tocado.

**Preferencias del dueño (no están en el repo; el otro perfil no tiene mi memoria):** respuestas cortas y ahorro de tokens; decisiones de a una (pregunta + recomendación + botones); UI escaneable con poco texto; HTML compartible solo con datos ficticios; usar DeepSeek (`~/.local/bin/opencode run -m opencode/deepseek-v4.1-flash-free`) para tareas de bajo riesgo (borradores de copy, resúmenes, listas), nunca con secretos/PII/código sensible; nunca correr seeds ni tests contra prod; no contactar residencias; sin API de WhatsApp; español rioplatense (voseo), marca «EstuRed».

**Nunca commitear:** `design-proposals/**`, `.claude/agents`, `.codex`, `AGENTS.md`, `scripts/_oneoff-*`.

---

## DR29: Centro de Guías fase 2, lotes 2A y 2B (2026-11-02)

- **Lote 2A (`7b670ab`, migración 0068):** tarjeta «Tu llegada» con cuenta regresiva y checklist de 47 ítems (`lib/arrival/*`, `components/students/ArrivalCard.tsx`). Tildes persistidas en `arrival_checklist_items` (una fila por reserva e ítem); lo tilda solo el estudiante dueño de la reserva; el familiar vinculado activo lo ve en solo lectura.
- **Lote 2B (`9ff0dd0`, migración 0069):** avisos de llegada. Estudiante a 14/7/2/0 días; familiar vinculado activo a 7/2. Nunca antes de las 9:00 (Argentina). In-app siempre; mail solo con `EMAIL_DOMAIN_VERIFIED=true`. El estudiante no puede desactivarlos. Sin catch-up: si el cron falla un día, ese aviso no se recupera. Código: `lib/jobs/notifyArrivalReminders.ts`, `lib/arrival/reminderPlan.ts`, `lib/arrival/reminderCopy.ts`; tabla `arrival_reminder_sends`.
- **Migraciones:** 0068 y 0069 aplicadas en **dev** (dicho por el dueño). **Pendientes en prod**: el bootstrap de prod debe incluirlas.
- **Verificado en navegador a 375 px:** tarjeta, tildado persistente y vista del familiar en solo lectura. Demo: `scripts/seed-arrival-demo.mjs` (usuarios Lucía y Martín).
- **Pendiente:** pulir catálogo del checklist (dueño); verificar mail real cuando haya dominio Resend con `EMAIL_DOMAIN_VERIFIED=true`; probar escritorio 1280 px.
- **Nota doc:** `docs/00` §31 (DR29, lote 2B) dice «migración 0069 pendiente de aplicar en dev y prod»; quedó desactualizado en dev. No modificado (docs/00 es del dueño).

---

## Traspaso 2026-11-02: Guías (DR28) y programa móvil L1–L12

- Hecho y commiteado (sin push): Centro de Guías fase 1 (`f64be6c`, `9b171f7`; hub `/guias`, 6 guías `content/guias/*.md`, `lib/guides`, SEO/JSON-LD, enlaces contextuales, aviso «llegar 2–3 semanas antes»); programa móvil L1–L12 (tab bar inferior, tablas como tarjetas, carruseles con swipe, hojas/modales, teclado móvil; informe en `design-proposals/movil-2026-11-02/informe.md`, untracked). `npm test` completo: 1487 OK tras `6360878`. Dev con migraciones hasta 0067.
- Pendiente Guías: las guías están en `borrador-editorial`; la revisión de tono de 05 y R01 se cerró (el dueño la descartó, 2026-11-03). Fase 2 (DR28): **hecha, ver DR29 arriba**. WhatsApp sigue solo como botón manual.
- Pendiente móvil: verificar negociación en navegador, táctil en dispositivo real y 1280 px en varios lotes.
- Pendiente producción: `NEXT_PUBLIC_SITE_URL` en `.env.local`, regla WAF en Vercel, proyecto Supabase prod + bootstrap 0056–0069, dominio Resend, `CRON_SECRET`, auditoría final, aviso a tutores de menores, logo final, decisión sobre `/waitlist` (H30). Los «pendiente de aplicar 0063–0066 en dev» de abajo ya están aplicados en dev; siguen pendientes en prod.

---

## DR22 D/E: alta de residencias en dos pasos, implementado (2026-11-01)

- Hecho en código (sin commit ni build): formulario `/register/residence`, cola `/admin/solicitudes-alta`, canje `/register/residence/invitacion/[token]`, CTAs «Solicitar sumar mi residencia». Tests: `lib/residenceSignup/rules.test.ts`.
- Pendiente: aplicar `0066` en dev y prod; probar a mano el flujo completo; decidir si `account_delivered` se puede fijar a mano; `build` sin correr.

---

## DR22: rediseño de home y alta de residencias en dos pasos (2026-10-31)

- Hecho: solo documentación (`docs/00` DR22). Sin código, build ni commit.
- Pendiente: definir con el dueño textos de hero y tabla, y campos/estados/quién contacta/plazo del alta de residencias; luego implementar (home, `/register/residence`, CTA «Sumar mi residencia», admin).

---

## DR19: vinculación de residentes con prueba de identidad (2026-10-30)

- Hecho en código (sin commit, sin build): migración `0064_resident_linking.sql` (**pendiente de aplicar en dev y prod**: `resident_stay_invitations`, `resident_link_requests`, `residence_private_details.house_code`, `missing_residence_requests`). Invitación personal (token 14 días, solo hash; mail automático + «Reenviar»; WhatsApp manual `wa.me` con enlace; OTP al mail si llegó por WhatsApp o sin token), corrección de mail, «no soy yo», menores con tutor; estudiante alojado: solicitud de vínculo (código de casa, cola en `/residence/[id]/residents`) y «Mi residencia no está».
- Datos dev: tras aplicar 0064, `node --env-file=.env.local scripts/seed-demo-resident-linking.mjs` (imprime los enlaces personales una vez).
- Pendiente: aplicar 0064 y correr el seed; verificar en pantalla (registro con enlace, activación con sesión, cola de la residencia); **dominio verificado de email** (bloqueante de producción, GAPS.md); aviso/consentimiento al tutor de un menor; pantalla de admin para «Mi residencia no está»; `build` y suite completa sin correr.

---

## DR18 fase 2, tanda 4 (2026-10-28)

- Hecho en código (sin commit, sin build): migración `0063_resident_without_email_faq_dedup.sql` (**pendiente de aplicar en dev y prod**: `resident_stays.invite_name/invite_phone`, FAQ-29/50 unificadas). Reglamento con asistente paso a paso + descarga; residente sin mail (nombre + teléfono, mail después); «Otro» aprobados en /search, filtros y vista del estudiante; mes vacío en acuerdo y comprobante; «antes/ahora» en la tarjeta de /search.
- Datos dev: `node --env-file=.env.local scripts/seed-demo-sin-fronteras-datos.mjs` (género por habitación, Hab 1 Doble para llegar a 28 plazas).
- Pendiente: aplicar 0063 y correr el script; verificar con screenshots; `typecheck`/`build`/suite completa sin correr; el asistente no guarda borrador en servidor.

---

## DR18 fase 2, tanda 3: segunda corrección del mes vacío (2026-10-28)

- Hecho en código (sin commit, sin build): migración `0062_empty_month_partial_units_faq.sql` (**pendiente de aplicar en dev y prod**: `empty_months_count` a `numeric(3,1)` y FAQ-51). Mes vacío por tramo con parciales desde la disponibilidad publicada (Premium y no Premium); ocupación real solo descarta tramos; sin disponibilidad publicada → «a confirmar». Código: `lib/applications/emptyMonths.ts`, `lib/residences/vacancy.ts`.
- Pendiente: aplicar 0062; verificar el desglose con screenshots; decidir si el tope de 3 meses es configurable; `agreedConditions`/comprobante aún no muestran el mes vacío; build y suite completa sin correr.

## DR18 fase 2, tanda 3: correcciones del dueño (2026-10-28)

- Hecho en código (sin commit, sin build): migración `0061_initial_payment_deposit_only_faq_mes_vacio.sql` (**pendiente de aplicar en dev y prod**: CHECK de `deposit_only`, columnas `empty_months_charge_usd/count` en snapshots, texto de FAQ-51). Pago inicial a elección (primer mes / matrícula / depósito / monto fijo). Mes vacío vuelve al desglose, snapshot y base del fee solo como cargo confirmado (`lib/applications/emptyMonths.ts` + `lib/residences/vacancy.ts`: estadías y reservas reales vs capacidad, solo Premium; sin dato confiable no se cobra y queda «a confirmar por la residencia»).
- Pendiente: aplicar 0061; verificar con screenshots el formulario (copy del mes vacío, radios de pago inicial) y el desglose en sus tres estados (cobrado / a confirmar / no aplica); `agreedConditions` y el comprobante todavía no muestran el mes vacío; build y suite completa sin correr. Decisiones: `docs/00`, «DR18 fase 2, tanda 3: correcciones del dueño».

## DR18 fase 2, tanda 3 (2026-10-28): dinero

- Hecho en código (sin commit, sin build): migración `0060_money_conditions_promotions.sql` (**pendiente de aplicar en dev y prod**), módulo puro `lib/applications/reservationMoney.ts` (descuento de matrícula, depósito en meses, promociones, pago inicial «solo matrícula»; lo usan el snapshot y la previa `CostBreakdown`), tabla `residence_promotions` + `PromotionsManager`/`promotionActions.ts` en el perfil, «antes/ahora» en tarifas de la ficha, mes vacío contingente fuera de la base del fee. Seed: `scripts/seed-demo-money.mjs` (correr tras aplicar la 0060 en dev).
- Pendiente: aplicar 0060; verificar con screenshots el formulario de condiciones, las promociones y el desglose de la solicitud; la tarjeta de `/search` aún muestra la tarifa de lista (sin promoción); renovaciones no aplican promoción; `build` y suite completa sin correr. Decisiones y supuestos: `docs/00`, «DR18 fase 2, tanda 3».

## DR18 fase 2, tanda 2 (2026-10-28): galería y ocupación/capacidad

- Hecho en código (sin commit, sin build): migración `0059_residence_photo_meta.sql` (**pendiente de aplicar en dev y prod**), editor de clasificación de fotos en el perfil (`PhotoMetaManager`, action `photoMetaActions.ts`), tarjeta de `/search` con carrusel (`CardPhotoCarousel`, `useRotation`), hero de la ficha que rota las destacadas y visor agrupado, «N plazas · M residentes» en ficha y tarjeta (`lib/residences/occupancy.ts`). Seed: `scripts/seed-demo-photo-meta.mjs` (correr tras aplicar la 0059 en dev).
- Pendiente: aplicar 0059; verificar a mano carrusel de la tarjeta y hero (hover/foco/reduced-motion) y el editor con screenshots; `typecheck`/`lint` ya en verde, falta `build` y la suite completa. Decisiones y supuestos: `docs/00` §31, «DR18 fase 2, tanda 2».

## Traspaso (2026-10-25)

Sesión cortada por límite de uso; sigue otra sesión/perfil. Estado detallado en `MEMORY.md` («Cierre de sesión 2026-10-25»). Los bloques DR14 de abajo están parcialmente superados: fases 1–3 ya implementadas.

### (a) Hecho y commiteado (sin push)
- `main` está **133 commits adelante de `origin/main`** (verificado con `git rev-list --count origin/main..main`; recontar). Sin push.
- Ciclos 73–74 `f372550`; plan de producción `eb8c551`; copy `ebc579a`, `84a4547` (DR12), `3e4eaf8` (DR13), `b357dd9` (DR15), `2a78e61` (DR16); DR14 docs `163d028`, fase 1 `9adb9c8` (0052), 2a `88d1471` (0053), 2b `60a7333` (0054), 3 `d9d1d91` (0055).
- **Untracked a propósito, NO commitear:** `.claude/agents/`, `.codex/`, `AGENTS.md`, `design-proposals/`.

### (b) Pendiente inmediato (en orden)
1. Auditoría final con los agentes `auditor` y `seguridad` sobre DR14 (0052–0055) y DR15.
2. Suite completa de integración: `npm test` (~5–7 min; el dev server vivo no molesta a vitest, pero **NO correr `npm run build` con el server vivo**) y `node --env-file=.env.local scripts/check-anon-exposure.mjs`.
3. Limpiar residuo: `node --env-file=.env.local scripts/cleanup-test-residences.mjs` (simula) y luego con `--apply`.
4. Probar a mano las pantallas nuevas: reglamento y aceptación, FAQ elegibles, edad mín./máx., seguimiento en `/admin/followups`; y captura de «Por qué EstuRed» en desktop y mobile.
5. Actualizar `docs/PLAN_SALIDA_PRODUCCION.md` si cambia algo y **regenerar el bootstrap prod** (`node scripts/build-bootstrap.mjs prod`) con 0052–0055.

### (c) Pendientes de producto
- Entradas D (14, resueltas en DR12) y L (19, resueltas en DR13) del inventario: **falta la revisión del asesor legal** (textos de arrepentimiento, Soporte, devolución) y la de DR16 «sin garantía propietaria» (cómo se comunica y verifica a las residencias).
- Mes vacío y sin prorrateo (`docs/IDEAS_DEL_DUENO_2026-10-23.md` §1–2).
- Multiple choice del reglamento y archivo PDF; aceptación del guardián en menores (y en propuesta del familiar / lista de espera: hoy quedan con `regulation_acceptance_pending`); vista de la aceptación guardada.
- Botón «Actualizar con mismos parámetros» (docs/06 §27.3); link de la encuesta en «Mi residencia»; pantalla admin del catálogo FAQ (hoy se edita por SQL).

### (d) Producción
- Proyecto Supabase nuevo (necesita cupo disponible); dominio real + `CRON_SECRET` para el bloque cron 0013; Resend/SMTP; redirect URLs de Auth; proveedor de tiles; WAF/rate limits; email de contacto real.
- Crear admin/superadmin con `scripts/create-admin.mjs` (credenciales de prod solo en esa invocación); cargar payment settings en `/admin/payment-settings`; revisión legal de `/terms` y `/privacy`.

### (e) Cómo trabaja el dueño
- Decisiones **de a una**: pregunta + recomendación + botones. Respuestas breves.
- Por cada migración: links al SQL Editor dev (https://supabase.com/dashboard/project/gyfbtsuibmecefwovdgh/sql/new) y prod, más el archivo a pegar. Dev ya tiene hasta 0055 (a la fecha de este texto; estado vigente en `MEMORY.md` §3); prod se arma con el bootstrap.
- Flujo: docs → agente → revisor/seguridad → fixes → `typecheck` + `lint` + `build` (server parado, `rm -rf .next`) → commit sin push.
- Elegir modelo/esfuerzo por tarea (sonnet medium/low por defecto).
- Co-autoría: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Agentes en `.claude/agents`: constructor, revisor, seguridad, depurador, tester, interfaz, base-datos, documentador, auditor, disenador.

---

## DR14 (2026-10-25) — decidida por el dueño y reflejada en docs; pendiente de implementar

Detalle en `docs/IDEAS_DEL_DUENO_2026-10-23.md` §5–§7. Protocolo `docs/13` §5 (doc primero): DR14 **ya registrada en `docs/00` §31 y reflejada en `docs/04` §12ter, `05` §16bis, `06` (§4.23–4.24, §8.1, §8.7, §11.5, §15.3, §17, §27.12) y `08` (§4.4, §4.5, §6.17, §7.16, §8.18)**. Fase 1 (edad) hecha (0052). **Fase 2a (reglamento + aceptación) implementada, migración 0053 sin aplicar** (ver `MEMORY.md` «DR14 fase 2a»; acción del dueño: aplicarla en dev y prod y correr `scripts/seed-demo-regulation.mjs`). Falta: FAQ de catálogo, apartado de menores, seguimiento a los 5 días, multiple choice y aceptación en propuestas del familiar / lista de espera.

- **Reglamento:** aceptación obligatoria al enviar la solicitud, con versión/hash y fecha; reglamento propio o modelo (`docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md`).
- **FAQ:** lista única; cada residencia elige cuáles mostrar y edita la respuesta.
- **Edad mínima/máxima** de la residencia como filtro de búsqueda (mínima 18; menores solo si se habilita; edad a la fecha de ingreso).
- **Seguimiento a los 5 días del ingreso:** recordatorio a la residencia + encuesta al estudiante que la residencia no ve; el admin decide qué comunicar.

---

## CICLO 74 (2026-10-24) — Permisos del staff elegidos por el dueño (DR11)

Ver `MEMORY.md` Ciclo 74 y `docs/00` §31 (DR11, con la tabla acción → permiso). Reemplaza el "un solo nivel de staff" de DR10: el dueño elige, staff por staff, 10 permisos (`residence_users.permissions`, sin migración), con atajos, desde `/residence/[id]/team`; al invitar elige los permisos iniciales. El servidor valida cada acción con `assertResidencePermission`; el staff ve deshabilitado (con nota) lo que no puede y un resumen «Tus permisos» en el Panel. ⚠ **Migración 0051 (sin aplicar, editada):** ahora agrega la columna `permissions` a `residence_team_invitations` (más lo del Ciclo 73: `invited_by` nullable). **Acción manual del dueño:** aplicarla en dev y en producción (SQL Editor → pegar y Run), orden 0046, 0045, 0047, 0048, 0049, 0050, 0051; si una versión vieja de la 0051 ya estaba aplicada, volver a correr esta (es idempotente). Después en dev: `node --env-file=.env.local scripts/seed-demo-team.mjs [--staff-permissions]` y probar guardar permisos con Ricardo y ver a Sofía con permisos apagados. Pendiente: verificar guardar/invitar/aceptar con la 0051 aplicada y los estados deshabilitados de Habitaciones, Residentes, Renovaciones, Lista de espera y Preguntas en pantalla.

**Revisión/seguridad del Ciclo 73 aplicada (ver `MEMORY.md` "Ciclo 73 — revisión y seguridad"):** auditoría con el rol real, IDOR de renovaciones, límites de invitación, revalidación al aceptar, email que informa si falló, PDF 403/404. **Decisiones pendientes del dueño:** ofertas de renovación del staff, mayoría de edad de la cuenta de staff, WAF/limitador de `/register/staff/*` y `/login`, remitente de email.

---

## CICLO 73 (2026-10-24) — Equipo de la residencia: dueño y staff (DR10)

Ver `MEMORY.md` Ciclo 73 y `docs/00` §31 (DR10, con la tabla de acciones dueño/staff). Dos niveles por residencia (`residence_users.role`), autorización central (`lib/residences/access.ts` + `permissions.ts`), perfil en solo lectura para el staff, propuesta de ajuste y PDF solo del dueño, pantalla `/residence/[id]/team` (invitar por email con token hasheado de 7 días, reenviar, cancelar, quitar acceso) y aceptación en `/register/staff/[token]`. ⚠ **Acción manual del dueño:** aplicar `db/migrations/0051_residence_team_invitations.sql` en dev y en producción (SQL Editor → pegar y Run), en orden **0046, 0045, 0047, 0048, 0049, 0050, 0051** (la 0051 no depende de las otras). Hasta entonces Equipo muestra miembros y permite quitar acceso, pero no invitar (se avisa). Luego en dev: `node --env-file=.env.local scripts/seed-demo-team.mjs` y probar con Ricardo (invitar/reenviar/cancelar) y la aceptación con el enlace que imprime el seed. Pendiente: verificar de punta a punta con la 0051 aplicada, unificar `actor_role` en la auditoría del día a día (hoy dice `residence_owner` aunque actúe un staff), presets finos (evolución futura), dominio propio de email.

---

## CICLO 72 (2026-10-24) — Trazabilidad y permisos del admin (DR9)

Ver `MEMORY.md` Ciclo 72 y `docs/00` §31 (DR9). Log legible (actor, entidad, frases, filtros), permisos de bloqueo (solo `superadmin` bloquea admins), lista de usuarios con filtros y paginación, jerga fuera del menú. Sin migraciones. Pendiente: verificar como Superadmin, contador de Revocaciones en el sidebar (no hay patrón de contadores), gestión de roles de admins, reorganizar el menú (decisión de producto).

---

## CICLO 71 (2026-10-24) — "Marcar pagado y confirmar reserva" endurecido (DR8)

Ver `MEMORY.md` Ciclo 71 y `docs/00` §31 (DR8). El admin solo marca pagado con comprobante cargado o con el override "Confirmar sin comprobante" (motivo ≥ 10 + segunda confirmación), carga el monto realmente recibido (tolerancia 1 %), confirma con "Verifiqué el pago" y no puede hacerlo con el plazo vencido; update condicional contra la doble confirmación. ⚠ **Acción manual del dueño:** aplicar `db/migrations/0050_fee_payment_received_amount.sql` en dev y en producción (SQL Editor), en orden **0046, 0045, 0047, 0048, 0049, 0050** (aborta si falta la 0047). Hasta entonces todo funciona y el monto recibido/override quedan solo en el audit log. Luego en dev: sembrar un fee `pending_manual_payment` con comprobante cargado y probar el éxito de punta a punta (reserva confirmada, comprobante, factura) y el estado vencido + reapertura desde Actividad → Reservas.

**Revisión/seguridad aplicada (ver `MEMORY.md` Ciclo 71 cont.):** checkbox "Acepto la diferencia" + piso 90 % (solo `superadmin`), fee `paid` con reserva sin confirmar → aviso + "Reintentar confirmación" en Cobrados (confirmación idempotente), UPDATE atado al estado y comprobante leídos, montos ambiguos rechazados, la 0050 ahora también revoca la lectura de `provider_payment_id`. **Falta verlo en navegador** (checkbox/piso, aviso y botón de reintento). **Decisión pendiente del dueño:** comprobante y Factura C salen por el fee esperado completo, no por el monto recibido.

Pendiente: mismas reglas para la validación manual del fee de **renovaciones**; "Rechazar pago manual"; mostrar el monto recibido y el override en "Cobrados"; aviso al pagador al validar.

---

## CICLO 70 (2026-10-24) — Ciclo de vida de la verificación (DR7)

Ver `MEMORY.md` Ciclo 70 y `docs/00` §31 (DR7). Sin migraciones. Pendiente: avisos de 60/7 días y del día del vencimiento (`docs/09` §7.5), aviso al programar visita, alinear el copy del job `expireResidenceVerifications` con el reenvío del dueño, y probar aprobar/rechazar de punta a punta con una residencia descartable.

---

## CICLO 68 (2026-10-24) — "Resolver revocación" (DR6)

Ver `MEMORY.md` Ciclo 68 y `docs/00` §31 (DR6). El admin reintegra el fee completo o deniega la revocación, siempre con motivo; el reintegro real es manual, por fuera de la plataforma. ⚠ **Acción manual del dueño:** aplicar `db/migrations/0049_revocation_resolution.sql` en dev y en producción (SQL Editor), en orden **0046, 0045, 0047, 0048, 0049** (la 0047 antes que la 0049). Luego en dev: `node --env-file=.env.local scripts/seed-revocation-states.mjs` y `MIGRATION_0049_APPLIED=1 npx vitest run lib/revocations/resolveFeeRevocationIntegration`, y probar en `/admin/activity?tab=revocations` (Admin operativo) la resolución de la revocación de Camila (restaurar o resembrar después).

**Ciclo 69:** el familiar pagador solo revoca si la estudiante es menor (DR6 (i), `MEMORY.md` Ciclo 69); falta verlo en navegador. Ronda de revisión/seguridad aplicada (ver `MEMORY.md` Ciclo 68): la 0049 ahora aborta si la 0047 no está aplicada (aplicar siempre en orden), Soporte no permite cerrar a mano casos `fee_revocation`, revocar como familiar exige vínculo activo y avisa al estudiante, y fees en USD exigen reconocimiento. **Decisiones pendientes:** plazo 240 h vs. día calendario, denegar con causa justificada, visibilidad del fee para la residencia, `refund_currency`.

**Textos legales para el asesor** (borrador, en `lib/revocations/copy.ts` bajo `LEGAL_REVIEW_PENDING`): `/terms` §17; pantalla `/students/revocation`; nota y checkbox de la pantalla del fee y de renovaciones; avisos de resolución; helper "Reserva revocada por vos"; `docs/10` §15.1/§15.4; condiciones para denegar y plazo de resolución.

Pendiente: decisión del dueño sobre el familiar pagador que puede revocar la reserva de una estudiante mayor (`GAPS.md`, para `seguridad`); aviso in-app a admins y a la residencia al revocar (no hay notificador genérico a admins); nota de crédito de la Factura C.

---

## CICLO 67 (2026-10-24) — Estudiante y familiar: plata y plazo

Ver `MEMORY.md` Ciclo 67. Sin migraciones. Pendiente: verificar en navegador el CTA del familiar pagador; decisión legal/de producto sobre reintegros (hoy el copy es neutro: "escribinos a Soporte"); aviso in-app al estudiante en hitos del fee.

---

## CICLO 66 (2026-10-24) — Reenvío a revisión tras "pedir cambios" (DR5)

Ver `MEMORY.md` Ciclo 66. ⚠ **Acción manual:** aplicar `db/migrations/0048_verification_changes_message.sql` en dev y producción (SQL Editor), en orden 0046, 0045, 0047, 0048. Luego `node --env-file=.env.local scripts/seed-needs-changes-demo.mjs` en dev para verificar el flujo completo y correr `MIGRATION_0048_APPLIED=1 npx vitest run lib/residences/verificationNotesRls`.

---

## CICLO 65 (2026-10-24) — Residencias, Bloque 3 (onboarding de residencias nuevas)

Ver `MEMORY.md` Ciclo 65. Sin migraciones. Lo pendiente sobre pedir cambios se resolvió en el Ciclo 66 (rechazo sigue por Soporte).

---

## CICLO 64 (2026-10-24) — Residencias, Bloque 2 (consistencia y copy)

Ver `MEMORY.md` Ciclo 64. Sin migraciones. Pendiente: verificación visual en navegador y revisar copy de plan/Gestión Operativa en `for-residences` y en el aviso de `setOperationalAccessByAdmin` (D8).

---

## CICLO 63 (2026-10-24) — Residencias, Bloque 1

Ver `MEMORY.md` Ciclo 63. Sin migraciones ni acciones manuales. Pendiente: aviso "por vencer 24 h" a la residencia (toca el cron), aviso al promover solicitudes de la cola, y verificación visual (Ricardo, owner de Residencia Norte).

---

## CICLO 62 (2026-10-24) — DR4: desglose de costos y "Proponer a [nombre]" en la ficha

Ver `MEMORY.md` Ciclo 62. Sin migraciones nuevas ni acciones manuales; siguen pendientes de aplicar la **0046 (urgente) y la 0045** del Ciclo 61. Siguiente: consentimiento `family_contact_disclosure` en las propuestas, decidir "subir comprobantes a la residencia" por el familiar y avisos in-app al estudiante.

---

## CICLO 61 (2026-10-23) — Experiencia del familiar vinculado (DR4)

Ver `MEMORY.md` Ciclo 61. ⚠ **Acción manual del dueño: aplicar PRIMERO `db/migrations/0046_family_link_active_only.sql` (urgente: cierra una fuga de datos) y después `db/migrations/0045_family_billing_profile.sql`, cada una en estured-dev y en producción (SQL Editor → pegar y Run; no hay supabase CLI).** Es aditiva e idempotente. Después, en dev: `npx vitest run lib/family` y, opcional, `node --env-file=.env.local scripts/seed-demo-family-payer.mjs` (ya corrido). Siguiente: desglose de costos y CTA "Proponer a [nombre]" en la ficha; decidir si el estudiante también recibe avisos in-app en los hitos; decidir "subir comprobantes a la residencia" por el familiar.

---

## CICLO 59 (2026-10-23) — "Quiero cambiar": datos y servidor (DR3/DR3b)

Ver `MEMORY.md` Ciclo 59. ⚠ **Acción manual del dueño: aplicar `db/migrations/0044_stay_change_intents.sql` en estured-dev y después en producción (SQL Editor → pegar y Run; trae queries de verificación al final; opción Terminal: no hay supabase CLI, usar el SQL Editor).** Después, en dev: `npx vitest run lib/stayChange` y `node --env-file=.env.local scripts/seed-demo-stay-change.mjs`. Siguiente: `interfaz` construye Mi residencia, la hoja "Responder", Residentes, la ficha y las landings sobre `lib/stayChange/*`; `seguridad` revisa RLS y acciones.

---

## CICLO 48bis (2026-10-21) — Documentación: decisiones D1–D11 (docs primero)

Ver `MEMORY.md` Ciclo 48bis. Sin acciones manuales sobre la base. Los docs de producto (`docs/00` §31, `02`, `04`, `06`, `08`, `10`) ya reflejan las decisiones del dueño; sigue la Fase 2 de `docs/audits/PLAN_ACCION_2026-10-20.md`. Pregunta abierta para el dueño: ¿la habilitación del pago a la residencia es automática al establecer contacto (como dice la fila de `docs/04` §5.4) o sigue siendo un botón de la residencia (como hace el código)?

---

## CICLO 47 (2026-10-21) — Auditoría Fase 1, ronda 2: H07 + H14 + H20 + H22

Ver `MEMORY.md` Ciclo 47. ⚠ **Acción manual del dueño: aplicar `db/migrations/0036_receipt_payload_privacy_and_owner_limit_lock.sql` en estured-dev y en producción (SQL Editor → pegar y Run; trae queries de verificación comentadas).** Para ver las notificaciones demo en dev: `node --env-file=.env.local scripts/seed-demo-notifications.mjs` (idempotente).

---

## CICLO 45 (2026-10-21) — Auditoría Fase 1: H01 + H05

Ver `MEMORY.md` Ciclo 45. Sin acciones manuales sobre producción (no hay migraciones). En la base **dev**: correr `node --env-file=.env.local scripts/seed-expired-fee-reservation.mjs` después de `seed-demo-data.mjs` (aditivo, idempotente). Pendiente: limpiar el residuo de tests en dev que deja a Lucía con 2 reservas confirmadas (hallazgo lateral 1 de MEMORY.md).

---

## CICLO 43 (2026-10-20) — Renovación extiende "Contrato hasta"

Ver `MEMORY.md` Ciclo 43. La migración 0035 ahora tiene 2 pasos (vínculo + extensión del contrato por renovaciones ya confirmadas): sigue siendo **una sola** acción manual, pegarla entera en el SQL Editor y correr las dos queries de verificación comentadas al final. Pendiente del dueño: actualizar docs/06 §14.2/§15.1 (`end_date` → `expected_end_date`).

---

## CICLO 42 (2026-07-24) — Vínculo estadía ↔ reserva

Ver `MEMORY.md` Ciclo 42. **Acción manual pendiente del dueño**: pegar `db/migrations/0035_backfill_resident_stays_reservation.sql` en el SQL Editor de Supabase (solo datos, idempotente) y correr el `select` de verificación comentado al final. Sin esa migración, las estadías ya existentes quedan sin vincular (el código nuevo solo cubre altas/activaciones nuevas) y en el panel de Residentes verán el aviso "sin reserva vinculada".

---

---

## CICLO 2 (2026-07-06)

Archivado el 2026-11-19 (obsoleto): ver `docs/archive/NEXT_STEPS_CICLO2_2026-07-06.md`.

---

## DR61 — push web (2026-11-20)

Hecho: docs (DR61, `docs/06` §21, `docs/07` §29.1, `docs/11`), migración 0101, service worker, envío con cola de las 9:00, UI de permiso y ajustes, emisores nuevos. Queda: aplicar 0101 en dev, claves VAPID en Vercel, probar en celular real, publicar `/instalar`, y decidir aparte la baja de cuenta, «pago rechazado» y «comprobante subido» (sin flujo). Detalle de pasos: `docs/PLAN_SALIDA_PRODUCCION.md`, sección «Push web».
