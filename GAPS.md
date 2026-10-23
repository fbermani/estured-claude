# GAPS.md — Auditoría técnica honesta de EstuRed

> Estado al 2026-10-21 (Ciclo 48bis, `62b9871` + documentación D1–D11). Las entradas nuevas están arriba; el resto conserva su orden histórico. Ordenado por severidad dentro de cada bloque.
> Contexto de arquitectura en [PROJECT.md](PROJECT.md); guía operativa en [CLAUDE.md](CLAUDE.md).
> Nota de calibración: el proyecto tiene ~2 días de código y es pre-lanzamiento. Varios gaps son **etapa esperada**, no negligencia — se marcan igual, sin suavizar, porque el próximo agente necesita saber qué falta de verdad.

---

## [ABIERTO — decisiones D1–D11 documentadas, código pendiente] Fase 2 de la auditoría 2026-10-20

**Qué es:** el dueño resolvió D1–D11 (`docs/00` §31; fuente `docs/audits/PLAN_ACCION_2026-10-20.md`) y los docs de producto ya reflejan cada una (protocolo `docs/13` §5: doc primero). Lo que **todavía no está implementado** (no confundir con "decidido"): D2 pantalla de pago con datos de transferencia + config admin de cobro (H02), D3 fuente única de disponibilidad por tipo de habitación (H03), D4 control de visibilidad del estudiante + consentimiento + menores ocultos (H04), D6 vencimiento de `contact_established` (H06), D7 campo "pago inicial para reservar" (H08, requiere migración), D8 quitar la frontera freemium de sidebar/"Tu plan"/`/for-residences` (H09), D9 FAQ simple con pregunta libre (H12), D10 reset de contraseña + `/terms` (H13/H19), D11 alertas de estadía vencida (H18). Cada ítem está en la tabla de Fase 2 del plan de acción; el estado vivo está en `MEMORY.md` §14.

**En curso al cierre del Ciclo 48bis (archivos sin commitear en el árbol de trabajo, no verificados):** D4 (`CommunityVisibilityCard`, `communityVisibilitySettings`) y D6 (`expireContactEstablished`, `paymentDeadline`, `ContactDeadlineNote`); marcarlos [RESUELTO] cuando se cierren sus ciclos.

**Ya resuelto de esas decisiones:** D1 (Ciclo 44), D5 (Ciclo 45: el estudiante ve la tarifa vigente con nota y la residencia ve la diferencia contra el snapshot).

---

## [ABIERTO — decisiones DF1–DF5 documentadas, código pendiente] Rediseño de la ficha pública (2026-10-23)

**Qué es:** el dueño decidió el rediseño de `/residencias/[slug]` (`docs/00` §31 DF1–DF4, `docs/08` §4.5; propuesta en `design-proposals/ficha-residencia/SPEC.md`). **Todavía no está implementado:** layout de columna sticky + hoja de solicitud, variante "{Tipo}: completa" en `StatusTag.tsx`, mapa con el pin exacto y universidades cercanas (DF5), `/comunidad` sin "Elegir este lugar" si el tipo no está `available_to_confirm` (H03), "Desde" = mínimo de tipos no completos. **DF5 (2026-10-23) reemplaza DF3 y DF4 (dirección):** dirección y coordenadas exactas son públicas. Lo ya escrito bajo el supuesto anterior queda desalineado: la migración `0042_residence_coordinates.sql` (CHECK de máx. 3 decimales), `lib/residences/approximateLocation.ts` (centro redondeado + radio), `lib/applications/exactAddress.ts` (gate por `contact_established`), el texto "una vez confirmada la reserva" de `CompactMap.tsx` y el hallazgo de seguridad sobre `address_line` legible con la anon key (que con DF5 deja de ser un riesgo). `residences.lat`/`lng` de `docs/06` pasan a `latitude`/`longitude`. **Pendiente de lanzamiento:** pasar de teselas OSM directas a un proveedor con clave (`docs/15` §23).

---

## [ABIERTO] Divergencias entre `docs/00`–`22` y el código que no se resolvieron en el ciclo de documentación

Reportadas sin tocar (cambiarlas es decisión del dueño, `docs/13` §5):
1. `docs/06` §9.1 modela condiciones de reserva (matrícula, depósito, política de ajustes, estadía mínima, mes vacío, `reservation_payment_*`) por `room_types`; desde la migración 0025 viven en `residences` (con CHECK matrícula⊕depósito). Además `beds` y `resident_stays.bed_id`/`room_type_id` (migraciones 0019/0025) no están en `docs/06`. Ya conocido desde el Ciclo 33bis.
2. `docs/04` §5.4 fila `contact_established → residence_payment_pending` dice actor "Sistema"; el código lo hace la residencia con "Continuar sin cambios (habilitar pago)". Se dejó un supuesto reversible en `docs/04` §5.8; falta que el dueño confirme si el paso debe ser automático.
3. `docs/08` §7.5/§7.18/§8.2bis siguen describiendo pantallas de upsell y gestión de plan; `docs/08` §3.3 y `docs/00` §31 las neutralizan (D8) pero el texto de esas secciones no se reescribió.
4. `docs/00` §20.2 describe una búsqueda automática en FAQ y archivos subidos; D9 (MVP) es pregunta libre que responde la residencia. `docs/00` §31 prevalece; §20 no se editó.
5. `docs/06` §9.1/§17 (`residence_faq_items`, `bot_interactions`) vs. el FAQ real (hasta 5 pares en `residence_profile_sections`, sin tablas de FAQ).
6. `docs/10` §9.1 y `/privacy` §4 dicen que el menor "no puede terminar el registro sin un familiar vinculado", pero el flujo real deja registrarse y bloquea la solicitud (Ciclo 46).
7. `docs/07` (API) no se revisó en este ciclo: puede tener rutas/server actions desactualizadas respecto de las decisiones D1–D11.

---

## [RESUELTO — Ciclo 44, 2026-10-20] Los tests de integración y los seeds escribían en la base de producción (H26)

**Qué era:** `.env.local` apuntaba al mismo proyecto Supabase que producción; los tests creaban y borraban filas reales y los seeds borraban/recreaban datos.

**Fix aplicado (D1):** proyecto `estured-dev` separado (otra cuenta de Supabase); `.env.local` apunta a dev. Guards: `vitest.setup.ts` lanza error y `scripts/_assert-dev-project.mjs` hace `process.exit(1)` si la URL es un ref de `scripts/production-refs.json`. Limpieza de residuos: `scripts/cleanup-test-residences.mjs`. Ver `MEMORY.md` Ciclos 44–46a.

**Sigue abierto (no bloqueante):** auditar qué dejaron los tests/seeds viejos en producción (agente `seguridad`, solo lectura); H27 (dataset demo con fechas relativas y fotos propias: las de `design-references/Fotos Residencias/` tienen marca de agua de terceros); confirmar que Vercel tiene las env vars de producción y no las de dev; arreglar el `afterAll` de `reissueBookingReceipt.test.ts` que deja residuo por FK.

---

## [RESUELTO — Ciclo 48bis, 2026-10-21] Documentación técnica desactualizada (`CLAUDE.md`/`AGENTS.md`/`README.md`, H32)

**Qué era:** `CLAUDE.md`/`AGENTS.md` decían "No hay script `test`", "No hay deploy configurado", "datos mock en `lib/mock/`", "el tipo de cambio es un mock hardcodeado" y que `/waitlist` era el destino de las solicitudes; `README.md` seguía en "Ciclo Fundacional 0, sin base de datos". Todo falso desde hace muchos ciclos.

**Fix aplicado:** corregidos con cambios puntuales (existe `npm test`/Vitest, deploy en Vercel, datos reales en Supabase, `ExchangeRateProvider`, routing real). `docs/00`–`10` actualizados con D1–D11 (`docs/00` §31). **Sigue desactualizado:** `PROJECT.md` (snapshot del Ciclo 3; ahora con aviso en la cabecera) y `docs/NEXT_STEPS.md` (parcialmente obsoleto).

---

## [RESUELTO — Ciclo 35bis (cont.), 2026-07-21] `createAuditLog` nunca lanza, ni siquiera en flujos de pago

**Qué era:** `createAuditLog` nunca lanza (trade-off aceptado desde el MVP) y el gap nunca se revisó al llegar a pagos (Ciclo 10-11) — si el insert en `audit_logs` fallaba silenciosamente al confirmar un pago/reserva, la operación de negocio se completaba igual sin dejar rastro auditable. Quedó abierto ~26 ciclos porque cambiar el comportamiento global afecta ~20 call sites y necesitaba decisión explícita del dueño.

**Decisión del dueño:** alertar a un admin sin revertir la operación — el dinero/reserva ya es real, revertir sería más riesgoso que un log faltante. Sin cambiar el comportamiento default de los otros ~20 call sites.

**Fix aplicado:** `createAuditLog` ahora devuelve `boolean` (antes `void` — cambio no rompe a los callers que ignoran el valor de retorno). Nueva `alertAdminsOfAuditFailure` (mismo archivo `lib/audit.ts`) notifica in-app a todos los usuarios con rol `admin`/`superadmin` cuando falla. Enganchado solo en los 3 call sites de dinero citados en la entrada original: `recordResidencePaymentReceived` (post-refactor Ciclo 20, antes `markResidencePaymentReceived`), `recordManualFeePayment` (antes `markFeePaidManually`), `confirmReservationAfterFeePaid`. **Hallazgo al implementar**: `AdminSidebar` nunca tuvo `NotificationBell` — ninguna alerta admin habría sido visible en ningún lado. Agregado (mismo componente que ya usan `StudentSidebar`/`ResidenceSidebar`, sin lógica nueva).

---

## [RESUELTO — 2026-07-09] Residencia de prueba del Ciclo 10 quedó visible en el catálogo real

**Qué era:** durante el e2e del Ciclo 10 (pago a residencia) quedaron 3 residencias de prueba en `verified_active` (1 usada para el test + 2 huérfanas de intentos fallidos del script de setup) — los scripts de limpieza automáticos fueron bloqueados por el clasificador de auto-mode del sandbox (interpretó los deletes acotados por ID exacto como "mass delete"/"bypass").

**Fix aplicado:** el dueño corrió el DELETE manualmente en el SQL Editor de Supabase (orden por FK documentado en `MEMORY.md` §13sexies). Catálogo real verificado en 0 residencias tras la limpieza.

**Pendiente relacionado (no bloqueante):** habilitar en `.claude/settings.json` un permiso de Bash acotado para scripts de limpieza de datos de prueba por ID, para no depender de intervención manual en cada ciclo que genere datos de e2e.

---

## [RESUELTO — Ciclo 3, confirmado obsoleto recién en Ciclo 26, 2026-07-10] El repositorio no tenía remoto — todo el trabajo vivía en una sola máquina

**Qué era:** el proyecto estaba versionado localmente pero sin remoto (`git remote -v` vacío) — único punto de falla total, los 23 documentos estratégicos son más valiosos que el código.

**Fix aplicado:** el dueño creó `github.com/fbermani/estured-claude` (privado) hace muchos ciclos — `git remote -v` confirma `origin` configurado y cada ciclo desde el 19 (al menos) termina con `git push origin main` exitoso. **Esta entrada quedó "Severidad: Alta" sin actualizar durante ~19 ciclos** después de resuelta — encontrado al revisar gaps abiertos antes de elegir el bloque del Ciclo 26; ejemplo real de por qué conviene re-auditar `GAPS.md` completo de vez en cuando, no solo agregar entradas nuevas.

---

## [RESUELTO — Ciclo 3, confirmado obsoleto recién en Ciclo 26, 2026-07-10] La única feature con backend apuntaba a una base de datos que no existía

**Qué era:** `getSupabaseAdmin()` devolvía `null` sin env vars, `.env.local` no existía, y la migración `0001_waitlist_signups.sql` nunca se había aplicado — la waitlist (única conversión del sitio en ese momento) fallaba silenciosamente para todo envío.

**Fix aplicado:** el dueño provisionó el proyecto de Supabase y completó `.env.local` hace muchos ciclos — confirmado por el uso exitoso y continuo de `getSupabaseAdmin()`/`getSupabaseServer()` en cada ciclo desde el 3 en adelante (incluye 15 migraciones aplicadas, Ciclos 8-24). **Misma situación que el gap anterior**: quedó "Severidad: Alta" sin actualizar ~19 ciclos después de resuelta.

---

## [RESUELTO — Ciclo 21, 2026-07-10] Cero tests de integración en los flujos de pago/reserva

**Qué era:** cero tests automatizados en todo el proyecto pese a que los Ciclos 10-11 ya shippearon lógica real de dinero (pago a residencia, fee EstuRed, confirmación de reserva) — señalado como severidad Alta porque `docs/16_QA_AND_TESTING_PLAN.md` exige tests por módulo y "auth y pagos sin tests serían inaceptables".

**Fix aplicado (Ciclo 12):** `npm i -D vitest` + script `"test": "vitest run"` + `vitest.config.ts` (resolución nativa de `@/*` vía `resolve.tsconfigPaths`, sin plugin extra). Cobertura inicial en las funciones puras de más riesgo real — donde un bug silencioso cobraría mal a alguien: `lib/mock/exchange.test.ts` (redondeo USD/ARS a múltiplos de 5/500) y `lib/applications/fee.test.ts` (cálculo del fee 5%), este último con 2 tests de regresión que reproducen exactamente las cifras verificadas a mano en los e2e de los Ciclos 8 y 10 (`MEMORY.md` §13cuater/§13sexies) — si alguien rompe el redondeo o la fórmula, el test falla con el mismo número que ya se confirmó correcto en producción simulada.

**Actualización (Ciclo 13, 2026-07-09) — candidato principal resuelto:** `lib/reservations/confirmAfterFeePaid.test.ts` cubre `confirmReservationAfterFeePaid` (la Internal Action de mayor impacto: confirma reserva, cierra solicitudes hermanas, descuenta disponibilidad, genera comprobante) con un test de integración real contra el Supabase provisionado del proyecto — no hay `supabase start`/CLI local instalada (confirmado, sigue sin estar disponible), así que se optó por reusar el Supabase real con fixtures propias creadas y borradas en `beforeAll`/`afterAll` en vez de mockear el cliente, priorizando fidelidad a los bugs reales que este proyecto ya tuvo (RLS recursion, FK bidireccional, embeds PostgREST ambiguos) sobre velocidad. `describe.skipIf` salta el test si no hay credenciales (CI sin secrets). Requirió un alias en `vitest.config.ts` para neutralizar `server-only` (el paquete solo tiene sentido bajo el resolver especial de Next; en Node plano tira una excepción) — ver `vitest.server-only-stub.ts`.

**Qué sigue sin cobertura (gap real, no cerrado)**: `lib/applications/residencePayment.ts` y los server actions de pago/negociación/propuesta del familiar siguen sin tests automatizados, solo verificación manual e2e en navegador+DB cada ciclo. Extender el mismo patrón de test de integración cuando se toquen de nuevo.

**Por qué `markResidencePaymentReceived`/`markFeePaidManually` NO recibieron el mismo test en el Ciclo 14 (pausado por diseño real, en ese momento):** a diferencia de `confirmReservationAfterFeePaid` (recibe `admin` y los datos por parámetro — "inyección de dependencias"), estas dos eran Server Actions que llamaban `getSessionUser()` internamente, que a su vez depende de `cookies()` de `next/headers` — requiere el contexto de request de Next.js real, no disponible en Vitest. Mockear `next/headers` es frágil (testearía el mock, no el comportamiento real) y refactorizarlas para inyectar la sesión (mismo patrón que `confirmAfterFeePaid`) era un cambio de diseño más grande que no se hizo sin pedido explícito en ese momento.

**Cierre parcial (Ciclo 20, 2026-07-10):** se aplicó el refactor sugerido a `markResidencePaymentReceived`/`markFeePaidManually`. `lib/reservations/recordResidencePaymentReceived.ts` y `lib/reservations/recordManualFeePayment.ts` extraen toda la lógica de negocio (incluida la validación server-side: motivo ≥5 caracteres, moneda válida, estado correcto, acceso a la residencia) de los server actions originales, que ahora son capas finas de ~15-30 líneas (resolver sesión, parsear `FormData`, delegar, `revalidatePath`). Ambas funciones tienen tests de integración reales contra el Supabase provisionado del proyecto (`recordResidencePaymentReceived.test.ts`, `recordManualFeePayment.test.ts`), mismo patrón que `confirmAfterFeePaid.test.ts` — más 2 tests de validación pura que no requieren credenciales. 17/17 tests verdes. Verificado además con clicks reales en el navegador sobre el dataset demo persistente (Ciclo 16), restaurado con `seed-demo-data.mjs` después.

**Cierre definitivo (Ciclo 21, 2026-07-10):** mismo refactor aplicado a `respondNegotiationProposal`/`respondFamilyProposal` — `lib/applications/recordNegotiationResponse.ts` y `lib/applications/recordFamilyProposalResponse.ts`. Particularidad de estas dos: los server actions originales terminan con `redirect()` de `next/navigation`, que solo funciona dentro del ciclo de vida real de un Server Action — quedó en la capa fina, no en la función pura. 8 tests de integración nuevos (25/25 en total, verificado en 3 corridas consecutivas). Verificado en vivo: Camila aceptó una propuesta de negociación real desde el navegador, con recálculo de fee correcto y encadenamiento a `residence_payment_pending`. **Bug real encontrado durante el propio desarrollo de los tests** (no en producción): la limpieza de fixtures del test de aprobación de `recordFamilyProposalResponse.test.ts` tenía la misma trampa de FK circular ya documentada varias veces en `MEMORY.md` (`application_requests.family_proposal_id ↔ family_application_proposals.converted_to_application_id`) — el delete fallaba en silencio y dejó una solicitud real huérfana en la cuenta de Lucía (usuario demo real), inflando su conteo de "solicitudes activas" y bloqueando corridas futuras del test. Corregido (chequear `error` explícitamente + `try/finally`); requirió 2 rondas de limpieza SQL manual del dueño para los residuos ya generados. Con este cierre, **las 4 server actions de dinero/reserva del loop central tienen su lógica de negocio extraída y testeada**: `confirmReservationAfterFeePaid` (Ciclo 14), `recordResidencePaymentReceived`/`recordManualFeePayment` (Ciclo 20), `recordNegotiationResponse`/`recordFamilyProposalResponse` (Ciclo 21).

**Qué sigue sin cobertura (gap real, no cerrado, menor)**: test de mapeo de `availabilityCopy` en `components/ui/StatusTag.tsx` (los 4 estados oficiales tienen copy) — bajo esfuerzo, sigue pendiente. `createFamilyProposal` (la creación de la propuesta por el familiar, no su respuesta) tampoco tiene test — menor prioridad porque no recalcula dinero.

---

## [RESUELTO — Ciclo 22, 2026-07-10] Sin job de vencimiento a 48h — `expires_at`/`payment_deadline_at` se guardaban pero nada los procesaba

**Qué era:** docs/00 §9.1 documenta 5 reglas de vencimiento a 48h (propuesta del familiar, solicitud sin respuesta de la residencia, pago a la residencia, respuesta a propuesta de ajuste, pago del fee EstuRed) y docs/07 §31 los nombra como 4 jobs concretos (`expire_family_proposals`, `expire_negotiation_proposals`, `expire_application_requests`, `expire_estured_fee_windows`), todos "cada hora". Ninguno estaba implementado — cualquier solicitud/propuesta/fee vencido quedaba colgado indefinidamente en su estado activo, sin transición automática.

**Fix aplicado:** `lib/jobs/expireFamilyProposals.ts`, `expireNegotiationProposals.ts`, `expireApplicationRequests.ts`, `expireEsturedFeeWindows.ts` (uno por job nombrado, mismo patrón `admin: SupabaseClient` + retorno tipado que ya usan `confirmReservationAfterFeePaid`/`recordManualFeePayment`) + `runExpirationJobs.ts` (orquestador). `app/api/cron/expire-stale-records/route.ts`: endpoint interno protegido por `Authorization: Bearer ${CRON_SECRET}`, invocado por `pg_cron` vía `pg_net` (`net.http_get`) cada hora — `db/migrations/0013_expiration_cron.sql` agenda el schedule.

**Decisión de implementación (análisis propio, no en docs literal):** docs/00 solo decide el disparador (pg_cron), no si la lógica de vencimiento vive en SQL o en la app. Se eligió TypeScript reusando el patrón "Internal Action" (evita duplicar `createAuditLog`/reglas de negocio en plpgsql) — respaldado por que `docs/11 §27.3` ya anticipaba `CRON_SECRET` en las env vars esperadas, señal de que el diseño previsto siempre fue un endpoint HTTP.

**Alcance deliberadamente acotado**: sin notificaciones reales (`NotificationProvider` pendiente, docs/00 §29); sin liberar disponibilidad automáticamente al vencer el pago a residencia (docs/00 §9.1: la residencia "puede" liberarla, acción manual, no automática); sin contar "hasta 3 intentos" en el vencimiento del fee (docs/07 §17.2) porque no hay cobro automático real que reintente todavía.

4 tests de integración nuevos (29/29 en total). Verificado en vivo: `401` sin auth, `401` con secret incorrecto, `200` con secret real contra el Supabase provisionado.

**Pendiente real, no bloqueante**: la migración 0013 necesita que el dueño reemplace 2 placeholders (URL de producción, `CRON_SECRET`) antes de aplicarla, y configurar `CRON_SECRET` en Vercel — hasta entonces el código está listo pero el cron no corre en producción. **Ciclo 48bis: no se pudo verificar desde el repo si la 0013 ya está aplicada en producción** (la auditoría 2026-10-20 sugiere que el cron del tipo de cambio no corre: hueco del 15/8 al 20/10). En dev está comentada a propósito. **H06 abierto:** el job solo vence `residence_payment_pending`; D6 pide que también venza `contact_established`.

---

## [RESUELTO — Ciclo 24] Sin rate limiting ni protección real anti-spam en la waitlist

**Dónde vivía:**
- `app/(public)/waitlist/actions.ts`

**Qué ocurría:**
La única protección era un honeypot (campo oculto `website`). Un script trivial que omitiera el honeypot podía insertar filas ilimitadas con emails únicos falsos.

**Por qué importaba:**
Es una tabla de PII expuesta a escritura pública indirecta. Spam masivo = base de leads inservible y costos de storage. `docs/11 §3.3` delegaba rate limiting a criterio técnico, pero "ninguno" no era un criterio.

**Fix aplicado (el más simple de los dos sugeridos originalmente):** columna `ip_hash` (SHA-256 de la IP, nunca texto plano) en la propia tabla `waitlist_signups` (`db/migrations/0014_waitlist_rate_limit.sql`) + `lib/waitlist/submitWaitlistSignup.ts` — rechaza el insert si ya hay 5+ filas con el mismo `ip_hash` en la última hora. Verificado en vivo: 5 envíos consecutivos insertaron correctamente, el 6to mostró "Ya recibimos varias solicitudes desde acá. Probá de nuevo más tarde." Ver MEMORY.md §13vicies.

---

## [RESUELTO — Ciclos 26-27, 2026-07-10] PII sin política de retención ni consentimiento formal

**Qué era:** se capturaba PII (waitlist y el resto del producto) con una promesa informal en el microcopy, sin link a política de privacidad (no existía página), sin checkbox de consentimiento, sin proceso de borrado documentado.

**Fix aplicado:**
- Ciclo 26: `/privacy` (ver MEMORY.md §13duovicies) — cubre qué se recolecta, para qué, con quién se comparte, menores, retención, derechos (Ley 25.326) y cómo pedir el borrado (hoy manual, por email). Linkeada desde el footer y desde `WaitlistForm.tsx`.
- Ciclo 27: checkbox de consentimiento explícito y obligatorio en `WaitlistForm.tsx` (ver MEMORY.md §13quatervicies), validado tanto client-side (`required` nativo del navegador) como server-side (`submitWaitlistSignup` rechaza el insert si no viene marcado), con timestamp `privacy_consent_at` guardado en la fila (migración `0015_waitlist_privacy_consent.sql`) siguiendo el mismo patrón de consentimiento nombrado con timestamp que `docs/10 §17.1bis`.

**Todavía abierto, no bloqueante:**
- El `docs/10 §27.1` (retención) y `§9.6` (menores) siguen marcados "pendiente de revisión legal" en el propio documento fuente — la página de `/privacy` lo hereda y lo dice explícitamente, no es un vacío nuevo introducido acá.
- `hola@estured.com` es un placeholder de contacto — el dueño confirmó usarlo así por ahora; reemplazar por el email real antes del lanzamiento público masivo.
- Sin runbook formal de "cómo borrar el registro de una persona a pedido" documentado en `docs/` (la página promete gestión manual, pero no hay un doc interno con los pasos exactos/tablas a tocar).
- ~~El resto del producto (registro de estudiante/familiar/residencia) no tiene todavía su propio checkbox de consentimiento~~ — **superado (verificado en Ciclo 48bis):** los registros de estudiante y familiar insertan `consents` versionados (`v0.1-borrador`); falta la página `/terms` (D10, pendiente) y el consentimiento de visibilidad de comunidad (D4, pendiente).

---

## [RESUELTO — Ciclo 9, 2026-07-08] El tipo de cambio hardcodeado alimenta todos los precios visibles

**Qué era:** todos los montos en ARS derivaban de `MOCK_EXCHANGE_RATE_ARS_PER_USD = 1480` (constante inventada), sin el modal obligatorio de `docs/08 §2.8`.

**Fix aplicado:** `ExchangeRateProvider` real (`lib/exchange/provider.ts`, monedapi.ar — dólar blue, valor venta), caché diaria en `exchange_rates` (migración 0009) con degradación en cascada (`lib/exchange/rate.ts`: override manual > fila del día > último valor conocido > mock como último recurso), y el modal/tooltip obligatorio (`components/ui/ExchangeRateNote.tsx`) en ficha de residencia, catálogo, negociación y perfil de residencia. Verificado e2e: tasa real (1520 ARS/USD el día de la verificación) cacheada sin duplicados y consistente en las 6+ pantallas que muestran USD→ARS.

**Pendiente resuelto en el Ciclo 17:** la UI de admin `/admin/exchange-rate` ya está construida y verificada e2e (forzar actualización, override manual con motivo, quitar override, histórico). Ver `MEMORY.md` §13terdecies.

---

## [RESUELTO — confirmado obsoleto en Ciclo 34unodevicies-bis, 2026-07-18] Mocks importados directamente por la UI en 4 archivos

**Fix aplicado:** `lib/mock/residences.ts` ya no existe en el repo — confirmado por grep (`from "@/lib/mock/residences"`: 0 resultados en `app`/`components`). El catálogo real (`/search`, ficha de residencia, etc.) lee de Supabase desde el Ciclo 34undevicies (ver MEMORY.md línea ~934, "el mock ya no existe, /search lee datos reales"). Único mock que sigue en pie: `lib/mock/exchange.ts` (tipo de cambio ARS/USD hardcodeado) — **eso es intencional, no un gap**: `CLAUDE.md` lo documenta explícitamente como decisión del dueño mientras no haya un proveedor de tipo de cambio real conectado. Entrada quedaba desactualizada desde hace varios ciclos — encontrada en la re-auditoría de gaps abiertos antes de elegir el bloque del Ciclo 34unodevicies-bis (mismo patrón que la re-auditoría del Ciclo 26).

---

## [RESUELTO — Ciclo 34unodevicies-ter, 2026-07-18] `Residence.photos` sin garantía de elemento — acceso `photos[0]` sin guard

**Qué era:** riesgo de crash por `photos[0]` sin guard, ya descartado en la re-auditoría del Ciclo 34unodevicies-bis; quedaba un gap cosmético (Severidad Baja): con 0 fotos aprobadas, la ficha no renderizaba nada en el lugar de la galería.

**Fix aplicado:** tercera rama en `app/(public)/residencias/[slug]/page.tsx` (`{photoUrls.length === 0 && (<div className="... bg-sand-200 ...">{ícono "apartment"}</div>)}`), mismo alto/radio que las otras 2 variantes de galería. Confirmado en el código actual (línea ~180) — esta entrada había quedado desactualizada; encontrado y corregido en la re-auditoría del Ciclo 35bis, mismo patrón recurrente que otras entradas de este archivo (ver comentario de la línea 146 de más abajo sobre re-revisar gaps abiertos periódicamente).

---

## [RESUELTO — resuelto hace varios ciclos, confirmado obsoleto recién en Ciclo 26, 2026-07-10] Dashboards placeholder duplicaban el layout a mano

**Qué era:** `students/` y `residence/` no tenían `layout.tsx`; cada page armaba la cáscara (`Navbar`+`main`+`Footer`) a mano.

**Fix aplicado:** `app/students/layout.tsx`, `app/residence/layout.tsx` y `app/admin/layout.tsx` ya existen los tres, con la protección de rol server-side incluida ahí (`getSessionUser` + `hasAnyRole` + `redirect`) — confirmado que ninguna page bajo esas tres áreas repite `Navbar`/`Footer` manualmente. **Tercera entrada de `GAPS.md` encontrada obsoleta en la re-auditoría de este ciclo** (junto con las dos de severidad Alta) — confirma que vale la pena re-revisar gaps abiertos periódicamente, no solo agregar entradas nuevas cada ciclo.

---

## [RESUELTO — Ciclo 27, 2026-07-10] Formulario "Sí" de accesibilidad a medias en Navbar mobile y FAQ

**Qué era:** el menú mobile del `Navbar` no tenía `aria-controls`/cierre con `Escape`, y el indicador «+» del FAQ (`<details>`/`<summary>`, correcto y nativo) era puramente visual sin marcarlo como decorativo.

**Fix aplicado:** `components/layout/Navbar.tsx` — `aria-controls="mobile-menu"` en el botón (apuntando al `id="mobile-menu"` del panel), `aria-label` dinámico ("Abrir menú"/"Cerrar menú"), y un `useEffect` que cierra el menú con `Escape` mientras está abierto. `app/(public)/page.tsx` — el `+` del FAQ ahora lleva `aria-hidden="true"` (el estado expandido/colapsado ya lo comunica nativamente `<details>`, el símbolo es puramente decorativo). Verificado en vivo en viewport mobile: `aria-expanded` cambia correctamente, `Escape` cierra el panel y lo desmonta del DOM, los 4 FAQ tienen el `+` oculto a lectores de pantalla.

**No incluido** (no estaba en el "fix sugerido" original, que solo pedía `aria-controls` + `Escape`): focus trap dentro del menú mobile mientras está abierto — mencionado en el "dónde vive" original pero no en el fix concreto. Si se retoma, sería una mejora incremental sobre esta, no un vacío nuevo.

---

## [RESUELTO — obsoleto, confirmado en Ciclo 35bis, 2026-07-21] Imágenes placeholder incoherentes y dependencia externa en `next.config.ts`

**Qué era:** `lib/mock/residences.ts` usaba URLs `picsum.photos` aleatorias, incoherentes con el contexto de cada residencia (ej. una de San Telmo mostraba una playa), y `next.config.ts` dependía de ese servicio externo.

**Fix real:** `lib/mock/residences.ts` ya no existe desde el Ciclo 34undevicies (catálogo real sobre Supabase) — confirmado por `test -f` y `grep -rn "picsum"` sin resultados en todo el repo. Las fotos hoy son reales, subidas por cada residencia a Supabase Storage (`residence_photo`). Esta entrada había quedado desactualizada; encontrada en la misma re-auditoría de GAPS.md que la anterior.

---

## [RESUELTO — Ciclo 28, 2026-07-10] Referencias de diseño corruptas en el repo

**Qué era:** 9 `screen.png` en `design-references/` (8 en `stitch_estured_mvp_1ra parte/`, 1 en `stitch_estured_4ta parte/`) eran texto de error de 28 bytes (`<FIFE Image failed to fetch>`) en vez de imagen real — las descargas de Stitch fallaron. Riesgo real: un futuro agente perdiendo tiempo intentando "leerlos" (ya había pasado en el Ciclo 2).

**Fix aplicado:** los 9 archivos corruptos borrados vía `git rm` (reversible en el historial de git si hiciera falta recuperarlos). `design-references/README.md` nuevo: instruye usar siempre `code.html` (la referencia completa en todas las carpetas), documenta qué se borró y por qué, y — a pedido explícito del dueño — instruye a cualquier sesión futura que necesite específicamente el `screen.png` de una de esas carpetas a decirlo explícitamente y pedir una captura/imagen, en vez de inventar el diseño a partir de otra fuente.

---

## [RESUELTO — Ciclo 15, 2026-07-09] `seed-demo-users.mjs` no creaba vínculo familiar activo

**Qué era:** el familiar demo (Martín, `padre.lucia@example.com`) no tenía fila en `family_members` ni `family_links`, pese a que `docs/17_SEED_DATA_AND_DEMO_SCENARIOS.md` (usuario demo #4) documenta explícitamente `name: Martin Fernandez`, `relationship: father`, `link_status: active`, `can_create_proposals: true` — no era una mejora inventada, el seed real no cumplía su propia especificación.

**Fix aplicado:** `scripts/seed-demo-users.mjs` ahora crea `family_members` para el seed con `familyMemberProfile`, y un paso final activa `family_links` (`status='active'`) para cualquier seed con `linkedStudentEmail` — idempotente (verificado corriendo el script dos veces seguidas, sin duplicar el vínculo). `lib/dev/demo-users.ts` actualizado ("Padre de Lucía, vínculo activo") y verificado visualmente en el widget de sesión simulada.

---

## [RESUELTO — Ciclo 16, 2026-07-09] Estado de solicitud del estudiante no distinguía reserva confirmada de fee pendiente

**Qué era:** `app/students/applications/[id]/page.tsx` mostraba el mismo label/helper estático ("Reserva creada" / "Ya podés pagar el fee EstuRed...") para `application.status = converted_to_reservation` sin importar si la reserva ya estaba `confirmed` (fee pagado) — encontrado explorando la app como Lucía con un dataset demo real. El lado de la residencia sí distinguía esto desde el Ciclo 11; el lado del estudiante había quedado sin el mismo tratamiento.

**Fix aplicado:** el label/helper ahora se calculan a partir de `reservation.status` (no solo `application.status`), mostrando "Reserva confirmada" con el copy correcto cuando corresponde; el formulario de subir comprobante de pago deja de mostrarse una vez que la reserva ya está confirmada.

---

## [Severidad: Baja] Inconsistencias menores de convención

**Dónde vive / qué ocurre:**
1. `components/ui/Input.tsx` exporta 3 componentes (`Input`, `Textarea`, `Select`) mientras el resto es un-componente-por-archivo.
2. `className` se concatena a mano en todos los componentes (`${className}`): dos clases Tailwind en conflicto (ej. `p-5` + `p-8`) quedan ambas y gana el orden del CSS, no el llamador. No hay `tailwind-merge`.
3. `docs/NEXT_STEPS.md` mezcla sección vigente (Ciclo 2/3) con histórico (Ciclo 0) en un solo archivo — funcional pero fácil de leer mal.
4. `Badge` (genérico) vs `StatusTag`/`TrustBadge` (semánticos): la frontera es intencional pero no está escrita en ningún lado salvo aquí y en CLAUDE.md.

**Por qué importa:**
Ninguna rompe nada hoy; todas son fuentes de fricción para quien entra nuevo.

**Fix sugerido:**
(1) y (4): documentado en CLAUDE.md — no refactorizar. (2): si los conflictos de clase empiezan a doler, `npm i tailwind-merge` y envolver la concatenación en `twMerge()` — cambio mecánico en ~8 componentes. (3): mover el histórico del Ciclo 0 al final del archivo o a `docs/archive/`.

---

## [RESUELTO — Ciclo 23, 2026-07-10] Sin implementación del derecho de revocación del fee — gap de cumplimiento legal, no solo de producto

**Qué era:** docs/10 §15.4 marca el derecho de revocación del fee dentro de 10 días corridos como "DECISIÓN CONFIRMADA" (requisito legal de contratación a distancia) y docs/08 §2.8bis exige el link "Botón de arrepentimiento" como **obligatorio** en el footer de toda la plataforma — ninguno de los dos existía. No era una feature de producto pendiente entre varias, era un gap de cumplimiento real en un sitio que ya procesa pagos de fee reales (modo manual).

**Fix aplicado:** `lib/reservations/revokeEsturedFee.ts` (docs/07 §18.6) — valida ownership (estudiante dueño o familiar pagador del fee, no cualquier familiar vinculado), estado `confirmed`, fee `paid`, ventana de 10 días desde `paid_at`. Cancela la reserva (`cancelled_by_student`, `student_revocation_right`), anula el comprobante (`voided`), el fee **permanece `paid`** (nunca `refunded` automático). `/students/revocation` + link obligatorio en `Footer.tsx`. 4 tests de integración nuevos (33/33 en total). Verificado en vivo de punta a punta.

**Simplificación deliberada, documentada, mismo criterio que otras pantallas admin de este proyecto**: sin `support_cases` (docs/07 §18.6 pide abrir uno — la tabla no existe, ningún flujo de soporte real construido). La auditoría completa en `audit_logs` cumple el propósito real (registro revisable) sin inventar infraestructura de soporte completa.

**Pendiente sugerido → [RESUELTO — Ciclo 25, 2026-07-10]**: `/admin/revocations`, tabla simple con fecha, estudiante, residencia, monto del fee, estado del fee y motivo. Ver MEMORY.md §13unvicies.

**Bug real encontrado en la propia verificación e2e**: séptima aparición de la trampa de FK bidireccional entre `reservations` y `estured_fee_payments` (ver MEMORY.md #10/#17/#18) — el embed implícito en la query de la página fallaba en silencio, mostrando "sin reservas revocables" con una reserva confirmada real. Corregido con el hint de FK explícito + chequeo de `error`.

---

## Trabajo incompleto conocido (intencional, no descuido)

| Qué | Estado | Dónde retomarlo |
|---|---|---|
| Push a GitHub | **[RESUELTO — Ciclo 3]** `origin` configurado | — |
| Supabase + `.env.local` | **[RESUELTO — Ciclo 3; Ciclo 44: dev y prod separados]** | `.env.example`, `CLAUDE.md` |
| Auth + roles + RLS + audit log | **[RESUELTO — Ciclos 3–5]** | `MEMORY.md` §1 |
| Deploy a Vercel | **[RESUELTO]** https://estured.vercel.app | `docs/15` |
| UI de admin `/admin/exchange-rate` | **[RESUELTO — Ciclo 17]** | `docs/09 §25` |

Nota (2026-07-08, actualizada 2026-10-21): esta tabla era un snapshot del Ciclo 0-1 — todos sus ítems están hoy resueltos (marcados arriba). `MEMORY.md` es la fuente de verdad viva; los ítems con encabezado `[RESUELTO — Ciclo N]` arriba en este archivo reflejan el estado real más reciente.

No hay TODOs/FIXMEs en el código (verificado por grep) — la deuda está documentada aquí y en `MEMORY.md`, no dispersa en comentarios.

## Ciclo 56 — Datos privados de residencia expuestos con la anon key (2026-10-23)

- **[ABIERTO — requiere aplicar migraciones]** `residences` es legible con la anon key (RLS por fila): exponía contacto del responsable, señal de calidad y auditoría interna del acceso a GO; `profile_availability.notes_internal` también. Fix escrito, no aplicado: `0043_residence_private_details.sql` → deploy → `0043b_drop_residence_sensitive_columns.sql`. Guard: `scripts/check-anon-exposure.mjs`. Detalle en `MEMORY.md` (Ciclo 56).
- **[RIESGO RESIDUAL]** flags comerciales (`has_operational_management_access`, `is_pioneer`, `pioneer_free_access_until`, `operating_mode`, `created_by`) siguen legibles con la anon key. Evaluar `GRANT SELECT (columnas)` por columna.
- **[REGLA]** Toda columna nueva con dato privado va a `residence_private_details` (service role), nunca a `residences`; toda columna nueva de `profile_availability` legible por RLS necesita su `grant select (col)` (0043b).
