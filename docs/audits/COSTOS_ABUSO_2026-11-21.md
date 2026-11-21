# Auditoría de costos y abuso — 2026-11-21

Solo lectura sobre el código. Sin pruebas de carga y sin tocar producción. Origen: checklist de costos de un reel (concepto, no su contenido exacto).
EstuRed no usa modelos de IA. Se aplicó la idea a Resend, Nominatim, Storage, Supabase y Vercel.

**Resultado: sin hallazgos altos.** Hay controles buenos. Quedan 2 medios y 4 bajos.

## Lo que está bien
- Rate limit persistente en Postgres (`lib/security/rateLimit.ts`, 0083). Falla cerrado en producción.
- Login, registro (estudiante, residencia, familiar, staff), recuperar contraseña y preregistro con límite por IP y por email, más Turnstile.
- Mails con límite en los puntos públicos: registro de residencia, preregistro familiar y vínculo familiar. El código OTP tiene cooldown y tope de intentos.
- Cron protegido con `CRON_SECRET` y comparación en tiempo constante.
- Subidas: tope por archivo (5 MB fotos, 10 MB comprobantes y documentos), tipo real verificado y cuota por estudiante (100 MB). Fotos de residencia con máximo por ficha.
- Optimizador de imágenes fijado al host exacto de Supabase (no es proxy abierto).
- `/api/csp-report` con tope de 8 KB y rate limit.
- Nominatim: solo al dar de alta una residencia o desde el botón del admin. Con `User-Agent` propio. Nunca lanza error.
- Tipo de cambio: se consulta una vez por día y se cachea en `exchange_rates`.

## Hallazgos
| # | Gravedad | Hallazgo | Dónde | Propuesta (PENDIENTE DE APROBACIÓN) |
|---|---|---|---|---|
| C1 | Media — **aplicado 2026-11-21 (parcial)** | Todas las páginas públicas son `force-dynamic`: `/search`, `/residencias/[slug]`, `/for-students`, `/verify` y `opengraph-image`. Cada visita ejecuta una función y consulta la base. Un bot o un pico viral multiplica costo y latencia. | `app/(public)/search/page.tsx:51`, `app/(public)/residencias/[slug]/page.tsx:6`, `.../opengraph-image.tsx:12` | Cachear el catálogo con revalidación corta (60 s) y sacar `force-dynamic` donde no dependa de cookies. Ya está en el runbook como R19-03/R19-04. **Aplicado:** el catálogo ya iba cacheado (R19-03, 120 s). Se sumó caché de 60 s a la ficha pública (`loadPublicFicha`) y de 300 s a la imagen de vista previa (`loadSharePreview`), con test de serialización JSON. **No aplicado:** `search`, `for-students` y la ficha siguen `force-dynamic` porque leen la sesión (filtro por edad, CTA, vista del estudiante o familiar). Pasarlas a estáticas exige mover lo personal a componentes cliente o en streaming (R19-04). |
| C2 | Media | No hay tope de gasto, alertas ni WAF configurados. El runbook los lista como opcionales o sin decidir. En Pro, un abuso se factura. En Hobby, el servicio se frena. | `docs/PLAN_SALIDA_PRODUCCION.md:220` y A2 | Antes de abrir: activar Spend Management en Vercel, alertas de uso en Supabase y Resend, y una regla de WAF con límite por IP en las rutas públicas. |
| C3 | Baja — **aplicado 2026-11-21** | Los límites de invitaciones de residentes usan `createRateLimiter` en memoria. En serverless cuentan por instancia, no entre instancias. | `lib/residents/inviteThrottle.ts:9-26` | Migrarlos a `consumeRateLimit` (persistente). |
| C4 | Baja — **aplicado en parte 2026-11-21** | Comprobantes de pago y de fee: tope por archivo, pero no por cantidad por solicitud. Un estudiante autenticado puede subir muchos de 10 MB. | `app/students/applications/[id]/payment/actions.ts:53`, `.../fee/actions.ts:93` | Tope de cantidad por solicitud (por ejemplo 10) y rate limit por usuario. **Aplicado** al comprobante del fee (10 cargas por hora por usuario). **Pendiente:** el comprobante de pago a la residencia se está reescribiendo en otra rama de trabajo (`lib/applications/studentPaymentProof.ts`); ahí hay que llamar a `proofUploadAllowed` y `proofCountWithinCap` de `lib/security/uploadLimits.ts` (ya hechos y con test) antes de subir el archivo. |
| C5 | Baja — **aplicado 2026-11-21** | Mails internos sin límite propio: `notifyResidenceTeam`, `teamInvitations`, `notifyPaymentSettingsChange`. Los dispara un usuario autenticado, así que el riesgo es bajo. El tope real es el de solicitudes activas. | `lib/residences/notifyResidenceTeam.ts`, `lib/team/teamInvitations.ts` | Confirmar que cada disparador tiene límite aguas arriba y sumar una cuota diaria de mails por residencia. **Aplicado:** `lib/security/mailQuota.ts` (100 avisos por día y 200 invitaciones a residentes por día, por residencia). Con la cuota agotada solo se omite el mail; el aviso dentro de la app se crea igual. Las invitaciones al equipo ya tenían tope por hora; los avisos a superadmin salen solo de acciones de superadmin; los códigos OTP ya tienen cooldown y máximo de envíos. |
| C6 | Baja — **aplicado** | `app/api/session/route.ts` dice en su comentario que las páginas públicas se prerenderizan estáticas. Hoy no es cierto (C1). El comentario confunde. | `app/api/session/route.ts:5` | Corregir el comentario junto con C1. |

## Pendientes fuera del código (del runbook)
- Cuota de Resend: confirmar el límite diario del plan antes del registro masivo.
- Plan de Supabase: Free pausa el proyecto tras 7 días sin actividad y no tiene backups propios (ya en A2).
- Alertas de errores y de uso: decisión abierta (P19-06).

## Cómo reabrir
Repetir esta revisión tras aplicar C1 y C2, y antes de la campaña de preapertura.
