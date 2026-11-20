# Auditoría complementaria de seguridad — 2026-11-15

Complementa `AUDITORIA_SEGURIDAD_2026-11-14.md`, `PLAN_SEGURIDAD_2026-11-12.md` y `SEGURIDAD_2026-11-11.md`. Solo cubre brechas de cobertura, pendientes y cambios posteriores. **No certifica producción ni declara seguridad total.**

## Resultado ejecutivo

Se confirmaron **dos hallazgos nuevos de severidad media** y **tres observaciones menores**. Los controles de aislamiento (RLS, Storage, RPC, bloqueo) y de DR48 resistieron las pruebas con sesiones reales.

| ID | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| SEG15-01 | Media | «Pago recibido» de la residencia crea reservas y fees duplicados si se confirma varias veces a la vez | Confirmado con prueba dinámica; **corregido en dev (2026-11-15, migración 0089 + reclamo atómico); pendiente en prod** |
| SEG15-02 | Media (baja en dev) | Soporte: sin tope de casos ni de evidencia acumulada por usuario | Confirmado con prueba dinámica; **corregido en dev (2026-11-15, sin migración); pendiente en prod** |
| SEG15-03 | Baja | Reemisión de comprobante sin compare-and-set: dos reemisiones simultáneas dejan dos comprobantes vigentes | Confirmado por código; **corregido en dev (2026-11-15, con test de concurrencia)** |
| SEG15-04 | Baja | 44 tablas conservan grants de escritura a `anon` (el RLS sin policies los neutraliza) | **Corregido en dev (2026-11-15, migración 0090); pendiente en prod** |
| SEG15-05 | Baja | Un registro de apertura DR48 puede existir sin que se haya entregado enlace (falla de firma) | Confirmado; comportamiento aceptable a documentar |

## 1. Alcance, entorno y límites

- **Rama / commit:** `staging`, `ea0a0c6` (23 commits después del `e8b1df8` de la auditoría anterior). Cambios locales: solo `scratchpad/` sin seguimiento y esta evidencia.
- **Entorno probado:** `estured-dev` (ref `gyfbtsuibmecefwovdgh`), verificado en el propio test antes de operar. No se tocó producción. El MCP de Supabase dio acceso de lectura al catálogo real.
- **Staging** (`estured.vercel.app`) está detrás del SSO de Vercel y no admite pruebas HTTP sin sesión de Vercel; `localhost:3000` no se usó por indicación vigente. Por eso las **server actions con cookies no se probaron por HTTP**: se llamó a los módulos reales con el cliente admin (así corre el servidor) y a la API de Supabase con JWT reales.
- **Fixtures:** 2 estudiantes, 2 residencias, 3 owners/staff por residencia, 1 cuenta admin, todos con prefijo `audit-sec-`. Se borraron al terminar; se verificó **0 residuos** (usuarios, Auth, residencias, archivos, casos, solicitudes, objetos de Storage de las últimas 3 h). Un objeto huérfano de un primer intento fallido de la propia prueba se borró por la API.
- No se alteraron usuarios demo ni configuración remota; no hubo migraciones, deploy ni push.

## 2. Cruce de antecedentes

| Comprobación | Clase | Decisión |
|---|---|---|
| SEG14-01/02/03, C1, A1/A2, M1–M7, B1–B15 corregidos | 1. Cubierta | Omitidos; no se reabren sin regresión |
| DR48 (acceso de residencias a documentos) | 4. Cambio nuevo | Auditado: sección 4 |
| Migraciones 0087 y 0088 | 4. Cambio nuevo | Sección 5 |
| Matriz dinámica por rol con JWT | 2. Implementada sin prueba suficiente | Ejecutada: sección 3 |
| Máximos/pausa concurrentes | 3. Pendiente conocido | Parcial: sección 6 |
| Login S4 no atómico | 3. Pendiente conocido | Verificado `consumeRateLimit` atómico (20 simultáneas, tope 5 → exactamente 5); el desacople entre peek y registro queda como estaba |
| Usuario inactivo / ban parcial en preapertura | 3. Pendiente conocido | Sección 7 |
| MFA admin | 3. Pendiente conocido | Sigue sin implementarse (0 referencias a `aal2` en `app`/`lib`) |
| CSP | 3. Pendiente conocido | Sigue en Report-Only; sin cambio |
| Dependencias | 1. Cubierta | `package.json` y lockfile sin cambios desde el commit auditado; `npm audit --omit=dev` = 0 |
| CORS, SSRF, SQLi/XSS genéricos | 5. No aplicable | La superficie no cambió; no hay CORS propio; ninguna entrada nueva controla destinos del servidor |

**Contradicciones de documentación:** `CLAUDE.md` dice «0001–0087»; existe `0088`, aplicada en dev. La auditoría previa contó 70 tablas; hoy hay 71 (la nueva es `residence_document_access_log`).

## 3. Aislamiento con sesiones reales (apartado A)

Sesiones reales (clave anónima + `signInWithPassword`): visitante, estudiante A y B, owner 1 y 2, staff con permisos, staff sin permisos y staff de otra residencia. **Menor, familiar vinculado/desvinculado y admin operativo/superadmin no se cubrieron** (ver «Pendiente»).

| Control | Resultado |
|---|---|
| Lectura cruzada de `application_requests`, `application_snapshots`, `files`, `student_profiles`, `users`, `residence_users`, 8 actores | Ningún actor vio filas ajenas |
| `residence_document_access_log`, `document_access_log`, `audit_logs` | 0 filas para los 8 actores |
| Notificaciones | El estudiante ve las propias y B no ve las de A |
| 14 mutaciones directas (cambiar estado ajeno, saltar estado propio, ascender permisos, volverse owner, sumarse a otra residencia, cambiar `primary_role`, insertar `user_roles` admin, desbloquearse, reasignar o borrar archivos ajenos, forjar el registro DR48, editar residencias ajenas) | 0 filas afectadas en todas; estado/rol/permiso intactos al releerlos con service role |
| Storage directo con JWT: firmar, descargar y listar `student-documents` como B, A, owner 1 y visitante | Denegado en los 4 |
| 7 RPC privilegiadas (`consume_rate_limit`, `peek_rate_limit`, `create_residence_private_details`, `publish_residence_regulation`, `consume_invite_otp_attempt`, `register_invite_otp_send`, `ensure_model_regulation_version`) como visitante, estudiante y owner | Denegadas en los 21 intentos |
| Bloqueado con sesión previa (`is_blocked=true`, JWT vigente) | Antes: ve su solicitud; después: 0 filas de solicitudes y de perfil (RLS restrictivo) |
| Auth: usuario baneado | Login nuevo, refresh y `getUser` fallan |

El catálogo vivo confirma el diseño: **0 policies permisivas de escritura para `authenticated`** en `public`. Toda mutación pasa por service role y server actions.

## 4. DR48 — acceso de residencias a documentos (apartado B)

Probado sobre `grantResidenceDocumentAccess` con fixtures reales (la acción que lo envuelve exige sesión de Next y no se ejecutó):

| Caso | Esperado | Obtenido |
|---|---|---|
| Owner abre doc de solicitante con pago habilitado | Enlace | Correcto |
| Staff con `payments.residence` | Enlace | Correcto |
| Staff sin permisos | Denegado | Denegado |
| Owner de otra residencia; `residenceId` manipulado (en ambos sentidos) | Denegado | Denegado |
| Documento de un estudiante sin vínculo con esa residencia | Denegado | Denegado |
| Archivo de otro bucket/tipo; id inexistente; estudiante como actor | Denegado | Denegado |
| Solicitud `rejected`, `cancelled_by_student`, `contact_established`, `submitted`; `converted_to_reservation` sin reserva viva | Denegado | Denegado |
| Permiso retirado; staff desactivado | Denegado de inmediato | Denegado |
| Estadía vigente con `residents.manage`; estadía cerrada | Enlace / denegado | Correcto |
| Registro: actor, rol, documento, residencia, vínculo, solicitud | Campos exactos y sin URL | Correcto |
| Solo los accesos exitosos dejan registro | `+2` filas tras 2 éxitos y 9 denegados | `+2` |
| Vigencia del enlace | ≤ 300 s | Correcto (token `exp` ≤ 300 s) |
| Falla al leer archivo, vínculos, membresía o registrar | Sin enlace | Sin enlace |
| Falla al firmar | Sin enlace | Sin enlace; el registro ya existe (SEG15-05) |

**Enlace ya emitido:** tras retirar permisos, un enlace emitido siguió respondiendo 200 hasta expirar. Es el período de validez previsto (300 s), **no se clasifica como fallo**. Impedir nuevos enlaces: comprobado. Invalidar uno emitido: no soportado por diseño.

**Observaciones de diseño (no vulnerabilidades):**
- El UI solo entrega el `fileId` a quien tiene el permiso; los demás ven «Entregado». Correcto.
- `grantResidenceDocumentAccess` no consulta `residences.status`: el dueño de una residencia pausada por admin o rechazada aún puede abrir documentos de solicitudes con pago habilitado. **Decisión de producto pendiente** (ver sección 10).
- `residence_document_access_log.residence_id` y `student_profile_id` usan `on delete cascade`: borrar la residencia o el perfil borra la traza. Coherente con el borrado total de tests, pero el derecho de supresión (I3) necesitará un procedimiento que conserve la traza.
- No se probó el limitador de aperturas (60/h) ni el UUID en el envoltorio; se verificaron por lectura.

## 5. Configuración real de la base (apartado C)

Lectura del catálogo vivo de `estured-dev` (esto **no certifica producción**):

| Dato | Valor |
|---|---|
| Tablas en `public` / sin RLS | 71 / 0 |
| Policies (public) / restrictivas / en `storage` | 118 / 46 / 0 |
| Vistas | 0 |
| Funciones `SECURITY DEFINER` ejecutables por `anon` | 0 |
| Tablas sin ninguna policy | 25 (RLS activo = denegación total para clientes) |
| Tablas con grants de escritura para `anon` | **44** (SEG15-04) |
| Buckets | 4 privados y `public-residence-media` público; límites de tamaño y MIME vigentes |
| `residence_document_access_log` (0087) | RLS activo, 0 policies y **sin grants** para `anon`/`authenticated` |
| `document_access_log` (0029) | RLS activo, 0 policies, pero grants completos para `anon`/`authenticated` |
| Triggers de validación en `application_requests`, `reservations`, `estured_fee_payments`, `booking_receipts`, `files` | Solo `updated_at` |
| Índices únicos en `reservations` | Solo la clave primaria |

La 0087 usa el patrón correcto y es más estricta que sus predecesoras. Las funciones privilegiadas fijan `search_path`. La tabla nueva no necesita policy restrictiva `_only_active_users` porque no tiene acceso de clientes.

La 0088 solo actualiza `suggested_answer` de FAQ-51 y FAQ-22. Verificada aplicada en dev.

**No verificable:** `pg_policies` y grants de **producción** (no existe aún); jobs de `cron` (0 en dev por diseño); drift entre migraciones y base más allá de los objetos consultados.

## 6. Concurrencia, idempotencia y estados financieros (apartado D)

### SEG15-01 — «Pago recibido» duplica reservas y fees

- **Gravedad:** media. **Clasificación:** CWE-362 / CWE-841. **Confianza:** confirmada con ejecución real contra dev.
- **Ubicación:** `lib/reservations/recordResidencePaymentReceived.ts:64` (lectura del estado), `:173` (insert de `reservations`), `:208` (insert de `estured_fee_payments`) y `:230` (update de la solicitud, solo por id).
- **Escenario realista:** el dueño o el staff con `payments.residence` confirma el pago y la acción tarda; hace doble clic, o dos miembros del equipo confirman a la vez, o el navegador reintenta tras un timeout.
- **Causa:** la acción lee `application.status === "residence_payment_pending"` y luego inserta. No reclama la solicitud con un update condicional y no hay índice único en `reservations(application_request_id)` ni restricción equivalente (catálogo vivo: solo `reservations_pkey`).
- **Evidencia:** 3 llamadas simultáneas a `recordResidencePaymentReceived` sobre la misma solicitud devolvieron `ok` las tres y dejaron **3 reservas, 3 fees pendientes y 3 eventos** de estado. Un reintento posterior sí se rechaza (la solicitud ya está convertida): el hueco es solo la ventana concurrente. Reproducible con la prueba `D1`.
- **Impacto:** reservas y fees duplicados para una misma solicitud; el estudiante o su pagador puede ver y pagar fees duplicados, con riesgo de cobros repetidos y reservas confirmadas dobles que bloquean plazas. No hubo pérdida de dinero en dev. La intervención administrativa sigue necesaria para confirmar cada fee, lo que limita el daño.
- **Corrección mínima:** hacer del primer cambio un reclamo atómico, `update application_requests set status = 'converted_to_reservation' ... where id = $1 and status = 'residence_payment_pending'`, y abortar si no afecta una fila; luego crear reserva y fee. Como defensa en la base: índice único parcial sobre `reservations(application_request_id)` y uso del `idempotency_key` (ya único) al insertar el fee. Limpiar el comprobante subido si se pierde la carrera.
- **Regresión:** el test `D1` debe exigir una sola reserva, un solo fee y un solo evento con 3 llamadas simultáneas.
- **Corrección aplicada (2026-11-15, solo dev):** reclamo atómico de la solicitud antes de crear nada (pierde la carrera → rechaza y limpia el recibo subido), reversión del reclamo si falla antes de nacer la reserva, e índice único parcial `reservations_one_per_application_uidx` (migración `0089`, aplicada en dev; 0 duplicados previos). `D1` ahora exige 1 ok, 1 reserva, 1 fee y 1 evento: verde. Falta aplicar 0089 en producción.
- **Vínculo:** distinto de SEG14-01/02/03 (esos son renovaciones, pausa y cuota). Misma familia que las correcciones de compare-and-set ya hechas.
- **Contraste:** `recordManualFeePayment` (`:152`), `confirmAfterFeePaid` (`:78`), `reopenEsturedFeeWindow`, `revokeEsturedFee` y el job `expireEsturedFeeWindows` sí usan estado condicional. Es el único paso del bucle de pagos sin él.

### SEG15-03 — Reemisión de comprobante sin compare-and-set (por código)

`lib/receipts/reissueBookingReceipt.ts:37` lee `status === "issued"`, inserta un comprobante nuevo (`:70`) y recién después marca el anterior como `reissued` sin condición. Dos reemisiones simultáneas dejarían dos comprobantes `issued` para la misma reserva. **Corregido en dev (2026-11-15):** reclamo atómico `update ... where status = 'issued'` antes de insertar, con reversión si falla el insert; test de concurrencia en `reissueBookingReceipt.test.ts` (3 reemisiones simultáneas → 1 vigente). Original: no se ejecutó la prueba. Gravedad baja (acción solo de admin, comprobante verificable por número). Corrección: reclamar con `update ... where status = 'issued'` antes de insertar.

### Pausa de residencia durante una solicitud y topes concurrentes

- La comprobación `verified_active` de SEG14-02 es una lectura seguida de un insert, **sin serialización**. El catálogo confirma que `application_requests` no tiene triggers de validación ni índices únicos de máximos, de modo que la ventana existe a nivel de base. **Parcial:** no se probó por HTTP ni con carga (el máximo de 2 solicitudes activas vive en la server action, que exige cookies).
- La cuota de documentos de SEG14-03 tiene recuento posterior: si dos subidas concurrentes lo superan, el diseño deshace las que exceden. No se ejecutó la prueba concurrente de la acción.

### Rate limit

`consumeRateLimit` es atómico: 20 llamadas simultáneas con tope 5 permitieron exactamente 5. El pendiente S4 del login (comprobación y registro separados) queda como estaba, acotado por los tres buckets (`login_ip`, `login_email`, `login_ip_email`).

### Proveedores de pago y webhooks

No hay proveedor operativo (flujo manual). No se inventó ninguna integración. Pruebas futuras: firma e idempotencia del webhook, reproducción del mismo evento, orden invertido y eventos tras vencimiento.

## 7. Sesiones, recuperación y permisos (apartado E)

- **Bloqueo:** `setUserBlockedStatus` (`lib/users/setUserBlockedStatus.ts`) combina `users.is_blocked` y ban de Auth con orden a prueba de fallos; el RLS restrictivo corta lecturas con sesión previa (probado). Un ban parcial deja el bloqueo en la base y devuelve error para reintentar.
- **Recuperación:** `redirectTo` se arma con `getAppUrl()` (variable de entorno), no con cabeceras del request; el envío se omite para usuarios inactivos o bloqueados; el flujo de reset ya cierra sesiones. Vencimiento, reutilización de enlaces y cambio de destinatario son gestionados por Supabase Auth y **no son verificables sin un buzón de pruebas**: queda como no verificable.
- **Usuario `is_active=false`:** **ningún flujo de la aplicación escribe `users.is_active=false`**, así que el caso solo existe por edición manual de la base. Los guards y el RLS restrictivo igualmente lo tratan como bloqueado. Pendiente conocido acotado a no aplicable hoy.
- **Preapertura y carrusel:** `communityRailData.ts` filtra `role='student'` y `consent_comunidad=true`, **sin cruzar con `users.is_blocked`**. Un estudiante bloqueado conserva su perfil consentido en el carrusel de otros usuarios. **Decisión de producto pendiente** (sección 10). El retiro de consentimiento sí quita el perfil al instante: no hay ISR ni cachés compartidas sobre estas páginas.
- **MFA y email verificado:** siguen sin implementarse ni exigirse en la aplicación; coherente con la etapa de preapertura. No se cambió ninguna decisión aceptada.

## 8. Entradas directas, archivos, cachés y abuso (apartados F, G, H)

- **Superficies nuevas:** DR48 valida UUID de `residenceId` y `fileId` en el envoltorio y deriva todo lo demás de la base. DR50–DR53 solo añaden copy y lógica de presentación. No hay entradas nuevas que controlen destinos del servidor.
- **Entradas inválidas por HTTP:** no ejecutadas (ver límites). Cubiertas por lectura.

### SEG15-02 — Soporte sin tope acumulado

- **Gravedad:** media en producción, baja en dev (cuota compartida de Storage).
- **Ubicación:** `lib/support/openSupportCase.ts:33` (`uploadEvidence`) y `:85` (`openSupportCase`); acciones en `app/students/support/actions.ts` y `app/residence/[residence_id]/support/actions.ts`.
- **Escenario:** un usuario con relación con una residencia abre casos de soporte en bucle con evidencia válida (hasta 25 MB por archivo, 6 MB por pedido por el límite global del cuerpo). No hay rate limit, cuota ni tope de casos abiertos.
- **Evidencia:** 6 casos seguidos con 6 archivos, los 6 aceptados (prueba `G1`).
- **Impacto:** agotamiento de la cuota de Storage y de la cola de Soporte, con el mismo patrón que SEG14-03 pero en `support-evidence`.
- **Corrección mínima:** freno persistente con `consumeRateLimit` (por usuario, p. ej. horario y diario), tope de casos abiertos por usuario y cuota de bytes acumulados de evidencia, con recuento posterior como en `documentQuota.ts`.
- **Regresión:** el test `G1` debe cortar antes del sexto caso.
- Otros uploads (`payment-proofs`, reglamento, fotos) están acotados por la máquina de estados o por conteos; las **fotos usan conteo previo** (pendiente conocido).

**Cachés:** `/api/session` responde `private, no-store`; las páginas con datos personales leen cookies y son dinámicas; no hay `unstable_cache` ni `revalidate` sobre datos personales. No se probó el CDN real de Vercel.

### SEG15-05 — Sobre-registro DR48

Si falla la firma, el registro de apertura (ya escrito) no corresponde a un enlace entregado. Prefiere sobre-informar que perder la traza. Aceptable; documentar para que no se lea como un acceso efectivo.

## 9. Cadena de suministro, despliegue y recuperación (apartados I, J)

- **Dependencias:** sin cambios en `package.json` ni lockfile desde el commit auditado; no se repitió el escaneo completo. `npm audit --omit=dev`: 0. Los avisos de herramientas de desarrollo y los `npx` sin lockfile de `video-hf` siguen como en la auditoría previa.
- **Repositorio:** no hay `.github/` (sin workflows de CI) ni `vercel.json`. Solo `.env.example` está versionado entre los `.env*`. **Protección de ramas y permisos de CI: no verificable** (no hay `gh` en esta máquina ni acceso al panel de GitHub).
- **Vercel (lectura de configuración, sin imprimir valores):** el proyecto tiene SSO activo para todas las URLs menos dominios propios. `DEMO_LOGIN_ENABLED`, `DEMO_USERS_PASSWORD` y `NEXT_PUBLIC_STAGING` existen **solo en Preview, rama `staging`**; Producción solo tiene las cuatro variables de Supabase/app. Así que **no hay herramientas demo en Producción**.
- **Observaciones de despliegue:**
  - Las variables de Supabase de Preview, incluido el service role de dev, **no están limitadas a una rama**: cualquier rama con Preview las recibe. Hoy es un repositorio con un solo dueño y SSO activo, riesgo bajo, pero conviene acotarlas antes de abrir el repo a más personas.
  - `TURNSTILE_SECRET_KEY` de Preview figura «legible» (Vercel `readable-secret`). Es la clave de prueba de Cloudflare; **en producción debe cargarse como Sensitive**.
  - Producción **no** tiene `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` ni las claves de Turnstile, y su proyecto de Supabase no se puede identificar (valores ocultos): son los pasos A/B del runbook, ya conocidos.
  - Con un dominio propio (`estured.com`) la protección SSO deja de aplicar a ese dominio: es lo esperado al abrir al público.
- **Detección y respuesta:** no hay Sentry ni log drains; los fallos de auditoría de dinero alertan a administradores dentro de la app (`alertAdminsOfAuditFailure`), **sin canal externo ni destinatario de guardia definidos**. No hay procedimiento de incidentes. Un log existente no prueba que alguien lo reciba.
- **Responsables:** repositorio, hosting y base están bajo la cuenta personal del dueño; el runbook A3 prevé pasarlos a organizaciones. No se asignó ningún responsable de incidentes (no inventado).
- **Recuperación:** `PLAN_SALIDA_PRODUCCION.md` indica que el plan Free de Supabase no tiene backups propios y propone `pg_dump` manual. **El runbook no dice que los objetos de Storage (documentos, comprobantes, fotos) no están en esa copia ni cómo respaldarlos.** Rollback de aplicación: Instant Rollback de Vercel; la base nueva es compatible hacia adelante, no hacia atrás. **No se probó ninguna restauración** (sin destino aislado autorizado).
- **Logs:** los `console.error` revisados no imprimen emails, tokens ni URLs firmadas; el registro de DR48 no guarda el enlace.

## 10. Decisiones de producto planteadas (de a una)

1. ¿El dueño de una residencia **pausada o rechazada** puede seguir abriendo documentos de solicitudes con pago habilitado? Hoy sí.
2. ¿Bloquear a un estudiante debe **retirar su perfil consentido del carrusel** de preapertura? Hoy no.

## 11. Cierre

### Brechas efectivamente comprobadas
- SEG15-01 (dinero, duplicados bajo concurrencia) y SEG15-02 (soporte sin cuota), con prueba dinámica reproducible.
- SEG15-04 y SEG15-05, menores. SEG15-03 por lectura.

### Pendientes conocidos todavía abiertos
MFA administrativo, CSP en enforce, verificación de email al lanzamiento, concurrencia de máximos y de pausa (ventana en la base), dependencias de desarrollo y `npx` sin lockfile, ban parcial/carrusel, S4 del login, restauración y respaldo de Storage.

### Controles omitidos por estar cubiertos
Correcciones de SEG14-01/02/03, hallazgos históricos corregidos, dependencias de producción, SQLi/XSS/SSRF/CORS genéricos, flags de cookies y redirecciones.

### Dependencias externas o decisiones necesarias
- Acceso a GitHub (protección de ramas, permisos de CI) y a los paneles de Supabase y Vercel de producción.
- Un destino aislado para probar restauraciones.
- Un buzón de pruebas para vencimiento y reutilización de enlaces de recuperación.
- Las dos decisiones de la sección 10 y la de producto de SEG14-01 (qué estado toma una oferta de renovación al vencer su fee).
- **Pruebas que faltan:** sesiones reales de menor, familiar vinculado/desvinculado, admin operativo y superadmin; server actions por HTTP en un entorno sin SSO; subidas concurrentes por la acción; reemisión concurrente de comprobantes; limitador de aperturas DR48.

### Qué afecta al desarrollo y qué debe resolverse antes de abrir al público
- **Ahora (dev):** SEG15-01 puede ensuciar datos de prueba con reservas duplicadas; SEG15-02 consume la cuota compartida.
- **Antes de abrir al público:** SEG15-01 y SEG15-02 corregidos con regresión; índice único en `reservations`; MFA administrativo; CSP en enforce; email verificado; acotar variables de Preview por rama; Turnstile y secretos como Sensitive; backup de base y de Storage con restauración probada; canal de alertas con destinatario e incidentes con responsable; revisar los grants de escritura de `anon`; repetir toda la matriz en el entorno que se publique.

## Evidencia reproducible

- Prueba: `docs/audits/evidence/2026-11-15/seguridad-complementaria.test.ts` (11 tests, fixtures aislados, se limpian solos).
- Ejecución: `npx vitest run docs/audits/evidence/2026-11-15/seguridad-complementaria.test.ts`
- Resultado sanitizado: `docs/audits/evidence/2026-11-15/results.json` (167 controles: 167 comprobados y 0 fallidos tras corregir SEG15-01 y SEG15-02 (en la medición original eran 165 y 2); sin tokens, cookies, URLs firmadas ni correos).
- La prueba corre solo contra el ref de `estured-dev` y se niega en otro.

## Decisiones del dueño (2026-11-15) — registradas en `docs/00` DR54

1. Residencia pausada/rechazada/no activa: **no** abre documentos de solicitantes con pago habilitado (implementado y probado).
2. Bloquear a un estudiante **no** lo saca del carrusel de preapertura (se deja como está).
3. Fee de renovación vencido: la oferta pasa a «vencida», se avisa a ambas partes y la residencia debe volver a enviar la renovación (implementado y probado).

## Cierre del bloque de cobertura (2026-11-15)

- **SEG15-04 corregido:** migración `0090` revoca INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER a `anon` y `authenticated` sobre todas las tablas de `public` (quedan solo los SELECT, gobernados por RLS y por los grants por columna de 0081) y cambia los privilegios por defecto para que las tablas nuevas no nazcan con escritura. Verificado en el catálogo de dev: 0 grants de escritura a nivel tabla y 0 a nivel columna. El cliente de la app no escribe con el JWT del usuario (solo `getSupabaseAdmin()` muta), así que no cambia ningún flujo. Antes la protección dependía de que no existiera ninguna policy permisiva de escritura.
- **Sesiones no cubiertas, ahora probadas** (`seguridad-sesiones.test.ts`, resultado en `results-sesiones.json`, 35 controles comprobados, 0 fallidos): menor y su tutor (vínculo activo ve; suspendido no), familiar con vínculo activo (ve), pendiente, revocado por el estudiante, revocado por la familia y sin vínculo (no ven), estudiante ajeno, anónimo, admin y superadmin (con su JWT no leen datos privados ajenos: el panel usa service role en el servidor). 13 escrituras directas (escalar rol, reactivar vínculo, aprobarse un vínculo, desmarcar `is_minor`, insertar auditoría falsa, borrar perfil ajeno, etc.) no cambiaron el estado real.
- **Pendiente de producción:** aplicar la 0090 junto con 0088 y 0089.
- **Sigue sin cubrir:** server actions por HTTP sin SSO, subidas concurrentes por la acción real, límite de apertura de documentos (DR48), SEG15-05 (registro de apertura si falla la firma; aceptado).
