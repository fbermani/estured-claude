# Auditoría de seguridad de EstuRed — 2026-11-14

## Resultado ejecutivo

**No se confirmaron vulnerabilidades críticas ni altas dentro del alcance revisado. Se confirmaron tres hallazgos medios: dos nuevos de lógica transaccional y uno conocido de consumo de Storage.** La revisión permite priorizar correcciones en desarrollo; no constituye aprobación de producción ni demuestra ausencia de vulnerabilidades.

| ID | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| SEG14-01 | Media | Un fee de renovación vencido puede volver a pendiente al subir otro comprobante | Nuevo; **corregido 2026-11-14** (dev) |
| SEG14-02 | Media | Aprobar una propuesta familiar antigua crea solicitud hacia una residencia pausada | Nuevo; **corregido 2026-11-14** (dev) |
| SEG14-03 | Media | Documentos de estudiantes sin cuota acumulada ni freno de subidas | B4 previo; **corregido 2026-11-14** (dev) |

Se recomienda corregir los tres antes de ampliar el acceso a usuarios reales. Los dos primeros requieren verificar transiciones y entradas alternativas; el tercero protege una cuota compartida que también importa en dev.

## Alcance y contexto

- Checkout revisado: rama `staging`, commit `e8b1df83db65515b579435ee211b5c3d129a896c`. Al iniciar solo existía `scratchpad/` sin seguimiento; se preservó.
- Entorno comprobado: **estured-dev**, ref `gyfbtsuibmecefwovdgh`. Se verificó contra `scripts/production-refs.json` antes de consultas remotas. No se accedió a producción.
- Aplicación: Next.js 15.5.29, React 19.2.7 instalado, Supabase SSR 0.12.0 y supabase-js 2.110.0.
- Revisión de autenticación, recuperación de contraseña, cookies, herramientas de desarrollo, rutas HTTP, server actions, autorización por rol/recurso, pagos y renovaciones, consultas públicas, privacidad de menores, documentos, Storage, inyección, secretos y dependencias.
- Base: reconstrucción estática de migraciones 0001–0086, consultas REST anónimas y configuración de buckets en dev. Las migraciones se analizaron en su estado final, evitando reportar policies históricas ya reemplazadas.
- Se aplicaron las skills locales **Next.js Security Scan** y **OWASP Security**; revisión por especialistas de datos, acciones y privacidad según las guías del proyecto.
- No se modificaron código de aplicación, migraciones, configuración desplegada ni reglas de negocio. Solo se generó este informe y se enlazó en la documentación de seguimiento. Sin commit ni push.

## Hallazgos confirmados

### SEG14-01 — Reactivación de un fee de renovación vencido

**Gravedad:** media. **Clasificación:** CWE-841, secuencia de estados incorrecta. **Confianza:** confirmada en código y prueba aislada del módulo real con dependencias simuladas; sin explotación en la base.

**Ubicación principal:** `lib/renewals/registerRenewalManualFeePayment.ts:101` (escritura de estado, líneas 101–112).

**Camino:** acción de pago de renovación → `registerRenewalManualFeePayment` → carga de comprobante → actualización del fee a `pending_manual_payment`.

La operación comprueba que la oferta pertenezca al estudiante y esté `estured_fee_pending`, pero no valida el estado ni `expires_at` del fee; la escritura filtra únicamente por su ID. El job `lib/jobs/expireEsturedFeeWindows.ts:20` vence los fees, pero su actualización de reserva depende de que exista `reservation_id`. Una oferta de renovación puede conservar `estured_fee_pending` después de que su fee haya quedado `expired`.

**Vector:** el estudiante dueño de esa renovación vuelve a enviar un comprobante válido tras el vencimiento. La operación devuelve el fee de `expired` a revisión. `lib/renewals/recordRenewalManualFeePayment.ts:30` tampoco valida el plazo al registrar la confirmación administrativa.

**Impacto:** se elude el vencimiento terminal del pago y su procedimiento de reapertura. Continúa siendo necesaria la intervención administrativa para confirmar: no se demostró una reserva gratuita ni modificación de un pago ajeno.

**Evidencia:** ejecución del módulo real con oferta propia pendiente y fee `expired`, `expires_at=2000-01-01`: devuelve `{ok:true}` y escribe `pending_manual_payment` con un nuevo archivo. El caso no necesita una carrera entre solicitudes.

**Corrección propuesta:** adoptar el control de estado/pagador/vencimiento del fee inicial (`app/students/applications/[id]/fee/actions.ts:158`). Hacer una actualización condicional que incluya estado esperado y plazo vigente, comprobar filas afectadas y borrar el objeto cargado si la operación pierde la carrera. Validar también plazo y estado de oferta al confirmar administrativamente. Alinear el vencimiento de la oferta con el de su fee según la máquina de estados oficial.

**Validación recomendada:** fee vencido rechazado sin cambio de estado ni archivo huérfano; fee vigente aceptado; dos envíos concurrentes no pisan una confirmación; admin no confirma un fee que venció antes de su intervención.

### SEG14-02 — Propuesta familiar hacia una residencia pausada

**Gravedad:** media. **Clasificación:** CWE-841, control de estado omitido. **Confianza:** confirmada en código y prueba aislada del módulo real; sin crear solicitudes reales.

**Ubicación principal:** `lib/applications/recordFamilyProposalResponse.ts:141` (conversión a solicitud, líneas 141–158).

**Camino:** `respondFamilyProposal` → `recordFamilyProposalResponse` → `createApplicationFromRoomType` → nueva solicitud.

Se vuelven a comprobar vínculo familiar, habitación y disponibilidad, pero no se exige `residences.status === 'verified_active'`. `getResidenceConditions` lee la residencia sin seleccionar su estado; el creador compartido tampoco lo valida. La entrada directa del estudiante sí exige ese estado en `app/students/applications/actions.ts:118`.

**Vector:** un familiar crea una propuesta mientras la residencia está publicada; luego un admin la pausa (`paused_by_admin`); el estudiante aprueba la propuesta antes de su vencimiento. `lib/residences/setResidencePausedByAdmin.ts:9` indica que la pausa debe impedir nuevas solicitudes, pero no cancela las propuestas anteriores.

**Impacto:** se genera una solicitud nueva hacia una residencia cuyo acceso a nuevas solicitudes había sido detenido. Sus miembros pueden acceder a ella y puede activarse la notificación correspondiente, con el riesgo de revelar datos/contacto fuera de la condición de publicación prevista.

**Evidencia:** la prueba aislada del módulo real convierte la propuesta sin consultar el estado de la residencia. El helper de creación se simula en esa prueba; su falta de validación se comprobó por lectura de código. No se encontró un trigger que compense esa omisión en las migraciones revisadas.

**Corrección propuesta:** exigir el estado publicado en el punto compartido que crea solicitudes, y verificar todas sus entradas, incluidas propuestas familiares y promociones desde listas de espera. Para cubrir pausas concurrentes, hacer que comprobación y creación se serialicen o queden dentro de una operación transaccional.

**Validación recomendada:** propuesta antigua rechazada tras pausa; propuesta válida para residencia activa aceptada; no se crean filas ni avisos al rechazar; revisar otras entradas al mismo creador.

### SEG14-03 — Documentos sin cuota acumulada por estudiante

**Gravedad:** media. **Clasificación:** CWE-400, consumo no controlado de recursos. **Confianza:** confirmada por el camino de escritura; no se hizo una prueba de carga. Corresponde al B4 ya registrado en el plan del 2026-11-12.

**Ubicación principal:** `app/students/profile/actions.ts:299` (`uploadStudentDocument`, carga/registro en líneas 299–308).

**Camino:** estudiante autenticado → subida de archivo válido → objeto con UUID nuevo en Storage → nueva fila en `files`.

Los controles de tamaño y formato son por archivo. No hay una cuota acumulada por usuario, un rate limit persistente de subidas ni eliminación/reemplazo del archivo anterior. Un estudiante puede repetir archivos válidos, sin necesitar el ID de otra persona.

**Impacto:** consumo de la cuota compartida de Storage y fallas de nuevas subidas de otros usuarios. Es relevante también para el plan de desarrollo; el límite global de 6 MB del cuerpo de server actions no impide la repetición.

**Corrección propuesta:** cuota por usuario de bytes y/o cantidad, reserva atómica de cupo antes de cargar y freno persistente de solicitudes. Definir retención/reemplazo de documentos respetando su trazabilidad y limpiar objetos si falla la inserción de metadatos. Un rate limit por sí solo retrasa el agotamiento; no sustituye la cuota.

**Validación recomendada:** rechazar al alcanzar cupo; admitir el documento válido bajo cupo; evitar sobrepasarlo con subidas concurrentes; no conservar objetos de operaciones fallidas.

## Controles comprobados

| Área | Evidencia y resultado | Límite |
|---|---|---|
| Tablas y RLS | 70 tablas creadas y 70 con RLS en migraciones; 72 policies literales finales de SELECT y 46 restrictivas dinámicas de 0081 | Reconstrucción estática, no lectura de `pg_policies` en vivo |
| Acceso anónimo | 70 tablas consultadas en REST dev; solo cinco devolvieron filas con `select=*`: `residences`, `room_types`, `residence_profile_sections`, `residence_faq_items`, `residence_faq_predefined_questions` | Tablas vacías no demuestran por sí solas ausencia de permisos; se contrastó con migraciones |
| Columnas privadas | `scripts/check-anon-exposure.mjs`: PASS, 11 columnas sensibles bloqueadas y 21 tablas privadas sin filas anónimas | No sustituye una matriz con JWT de todos los roles |
| Storage | Cinco buckets en dev; únicamente `public-residence-media` público; los otros cuatro privados, con límites de tamaño/MIME | No se probó restauración ni recuperación de objetos |
| Roles y tenants | Inventario de 206 funciones en archivos de acciones; guards admin propios, pertenencia a residencia derivada del recurso y permisos que fallan cerrados | No se ejecutó una matriz dinámica completa por rol |
| Usuarios bloqueados | `getSessionUser` verifica estado; migración 0081 agrega restrictivas; bloqueo Auth desde servidor | Ver observación específica de preapertura más abajo |
| Familia y menores | Vínculo activo para lecturas; carrusel 18+ con consentimiento y proyección cerrada; no expone contacto, apellido, ID ni nacimiento | No se autentica la identidad civil mediante un OTP |
| Documentos y recibos | Documentos administrativos con motivo y log; URLs firmadas de 300 s, reglamento de 600 s; verificación pública por número con datos mínimos | Un enlace firmado concedido sigue siendo usable hasta su expiración |
| Sesiones | Cookies Auth HttpOnly, SameSite=Lax, Secure con build de producción; `safeInternalPath` rechaza destinos externos | La pista de sesión es deliberadamente legible por JS y no contiene credenciales |
| Auth dev | `/auth/v1/settings`: `disable_signup=true`, `mailer_autoconfirm=false` | Las altas propias usan Admin API y preconfirman email por decisión de preapertura |
| Cron y rutas | Cron sin secreto válido: 401; áreas admin/residencia/estudiante sin sesión redirigen al login; `/api/session` devuelve `private, no-store` | Solo smoke tests sin sesión |
| Staging | La URL pública `https://estured.vercel.app` redirigió al login de Vercel sin credenciales | No se inspeccionaron permisos de equipo, bypasses ni todas las URLs de deployment |
| Inyección y secretos | Sin camino confirmado de SQLi/XSS/SSRF; escaneados 1561 archivos de texto actuales y 4428 blobs de texto históricos en todos los refs locales con patrones de claves privadas, JWT y tokens; sin candidatos | Escaneo por patrones y blobs de hasta 2,5 MB; no prueba ausencia de secretos arbitrarios ni cubre refs remotos no descargados |

Las políticas finales eliminan las escrituras directas sensibles de clientes. Las funciones SQL `SECURITY DEFINER` revisadas fijan `search_path`; las RPC de escritura quedan restringidas a `service_role`. La clave privilegiada conserva `import "server-only"`.

## Dependencias: avisos de herramientas de desarrollo

- Raíz, `npm audit --omit=dev --json`: **0 avisos**.
- Raíz, `npm audit --json`: **7 paquetes afectados** (1 alto y 6 moderados según npm), todos en herramientas de desarrollo. `brace-expansion@1.1.15` llega por ESLint; `minimatch@10.2.6` por TypeScript ESLint. `npm ls ... --omit=dev` no encuentra esos paquetes en el árbol de ejecución.
- Subproyecto `video`, `npm audit --json`: **10 paquetes afectados, moderados**, en el árbol ESLint/TypeScript ESLint. No se cuentan como diez vulnerabilidades independientes: varios avisos propagan el mismo problema transitivo.
- `video-hf` invoca `hyperframes@0.9.31` mediante `npx` y no tiene lockfile propio: esta revisión no resuelve ni audita todo el árbol efímero descargado por ese comando.

No se demostró una ruta desde una solicitud web hasta los analizadores vulnerables. Corresponde actualizar el lockfile de las herramientas en un cambio separado y comprobar lint; **no presentar el aviso alto de npm como una vulnerabilidad alta remota de EstuRed**. Referencias consultadas: [aviso de minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) y [aviso de brace-expansion](https://github.com/advisories/GHSA-qhr7-859c-m2p7).

## Observaciones y pendientes separados de los tres hallazgos

### Aspectos de desarrollo esperados

El selector demo, las cuentas de prueba, los secretos Turnstile de prueba y los bypasses explícitos de desarrollo no se clasificaron como fallas por existir en dev. El selector tiene allowlist y guard de servidor; las herramientas de staging están detrás de la protección de Vercel comprobada en la URL examinada. Mantener su separación de producción y usar una base de producción limpia.

### Requisitos antes de beta o apertura operativa

- **MFA admin/superadmin:** está exigido en `docs/11_TECH_ARCHITECTURE.md:594` y `docs/18_RELEASE_AND_BETA_CHECKLIST.md:293`, pero los guards de `lib/auth/requireAdmin.ts` solo comprueban sesión y rol; no exigen `aal2`. No se encontró flujo de enrolamiento/desafío MFA. Implementarlo y exigir el segundo factor en lecturas y mutaciones privilegiadas antes de beta; habilitar MFA en el proveedor sin exigirlo en la aplicación no basta. [Guía oficial](https://supabase.com/docs/guides/auth/auth-mfa).
- **Verificación de email:** diferida por decisión del dueño a lanzamiento. Mantener el requisito de email probado antes de solicitudes, pagos o contacto con residencias; las cuentas preconfirmadas actuales no prueban control del buzón.
- **CSP:** sigue en Report-Only; reporta pero no bloquea. Pendiente conocido M5. No se encontró una inyección XSS que permita elevarlo a vulnerabilidad explotable en esta revisión.
- **Configuración real de producción:** claves Turnstile reales, signup directo cerrado, secretos y URLs reales, demo deshabilitada, backups y restauración probada. No se comprobaron contra un entorno productivo.

### Requieren definición o comprobación adicional

- `saveProfile` de preapertura usa `getSafeUser` y escritura privilegiada sin consultar `is_active/is_blocked`; el carrusel no filtra el estado de `users`. No se afirmó que un ban Auth exitoso pueda eludirse: Auth rechaza usuarios baneados. Queda revisar el caso `is_active=false` o fallo parcial del ban y definir si bloquear una cuenta debe retirar también su perfil consentido del carrusel. [Implementación primaria de Auth](https://github.com/supabase/auth/blob/master/internal/api/auth.go#L52-L55).
- Los máximos de solicitudes y el tope de fotos usan conteos previos a inserts; existe una ventana de concurrencia. No se hizo prueba de carga ni se midió su explotación en dev. Serializar los cupos al corregir esa área.
- Límite de login: comprobación y registro de fallos separados; pendiente S4 previo, de impacto acotado por los otros controles. No se demostró fuerza bruta ni se generó tráfico de ataque.

## Verificación y límites prácticos

| Comprobación ejecutada | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errores y 51 advertencias preexistentes |
| Unitarios de Turnstile, rate limit, redirects, contraseña, guards admin, cookies y pantallas dev | **39/39**, 7 archivos |
| Archivos/comunidad/verificación de recibos | **36/36**, 4 archivos; incluye integración dev de `verifyLookup.test.ts` |
| Chequeo de exposición anónima y REST de las 70 tablas | PASS dentro de las comprobaciones descritas |
| Estado de Auth, buckets y protección de la URL staging | Consultas actuales realizadas |

La prueba de integración de recibos creó fixtures temporales en dev y los eliminó automáticamente. Un SELECT posterior confirmó **0 residencias residuales** para el nombre/prefijo exactos del test; no se ejecutó limpieza masiva. No se tocó producción ni se modificaron datos de usuarios ajenos a esos fixtures.

Reproducciones aisladas de SEG14-01 y SEG14-02: `node docs/archive/evidence/2026-11-14/repro-actions.cjs`, desde la raíz del repo. Usan los módulos reales y dependencias simuladas, sin cargar credenciales ni conectarse a la base. Resultado capturado en `docs/archive/evidence/2026-11-14/repro-actions-results.json`. Sus asserts demuestran el comportamiento inseguro actual; al corregirlo, deben sustituirse por regresiones que exijan el rechazo.

El primer intento de `/api/session` devolvió un 500 transitorio del servidor de desarrollo; las comprobaciones posteriores devolvieron 200 y las cabeceras esperadas. No se atribuyó a una vulnerabilidad sin una causa reproducible.

No se ejecutó la suite completa que crea datos reales, un pentest con carga, un escaneo autenticado de todos los roles ni un build: el dev server estaba activo y las reglas del repo prohíben compilar en paralelo con él. No se modificó código que requiera reconstrucción.

Sin acceso SQL administrativo de lectura al catálogo real no se certifican `pg_policies`, grants, extensiones, cron ni drift entre todas las migraciones y la base. Tampoco se auditaron la configuración interna de las cuentas de Vercel/Supabase/GitHub, todos los deployments, secretos remotos, proveedores de pago/facturación sin credenciales operativas, backups o restauración. El resultado de dev no debe extrapolarse a producción.

## Orden propuesto de corrección

1. SEG14-01: fee de renovación y vencimiento, con regresiones de estado y concurrencia.
2. SEG14-02: guard compartido para altas de solicitudes, con regresión para propuestas previas a una pausa.
3. SEG14-03: cuota acumulada y freno persistente de documentos, sin perder trazabilidad.
4. Actualizar herramientas de desarrollo afectadas y cerrar la matriz dinámica de permisos.
5. Completar MFA y los requisitos del runbook antes de beta/apertura; repetir los chequeos en el entorno que vaya a publicarse.

## Estado de las correcciones (2026-11-14, dev)

- **SEG14-01:** `registerRenewalManualFeePayment` hace compare-and-set (estado `pending_payment_method` y plazo vigente) y limpia el comprobante si pierde; `recordRenewalManualFeePayment` rechaza fees vencidos y su update es condicional. Regresión en `lib/renewals/renewals.test.ts`. **Decidido 2026-11-15 (DR54):** la oferta pasa a `expired_no_student_payment`, se avisa a ambas partes y la residencia envía una renovación nueva (no se reabre).
- **SEG14-02:** `createApplicationFromRoomType` exige `residences.status = 'verified_active'`, lo que cubre solicitud directa, propuesta familiar y lista de espera (esta última tampoco validaba). Regresión en `createRequestFromRoomType.test.ts`. No serializa la pausa concurrente.
- **SEG14-03:** `lib/students/documentQuota.ts` (40 archivos / 100 MB por estudiante, 20 subidas/h por usuario con `consumeRateLimit`) y recuento posterior que deshace la subida concurrente que excede. Sin migración. Topes son supuestos reversibles. No cubre comprobantes de pago ni documentos de residencia.
