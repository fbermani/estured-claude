# Capa Cero — diagnóstico inicial y plan (2026-11-20)

Proveedor externo de seguridad. Informe CC-2026-1120-01, ítem 01, sin cargo, 60 minutos.
Objeto: staging (`estured.vercel.app`, base `estured-dev`). Producción no se tocó.

## Resultado del diagnóstico
- Revisión pública, sin sesión: tres páginas, cabeceras y 13 scripts. Sin explotación.
- **E-01 (media, endurecimiento):** la CSP está en `Report-Only` y `script-src` incluye `unsafe-inline`. No bloquea nada.
- **Next.js 15.5.29 confirmada** en el cliente. Incluye los parches de 15.5.28 y 15.5.29.
- Bien: HTTP→HTTPS (308), HSTS, `DENY`, `nosniff`, `no-store`, sin cookies en páginas públicas, sin claves ni mapas de código.
- No validó: RLS, Storage, roles, sesiones, claves de servicio, lockfile ni build de Vercel.

## Nuestra lectura
- E-01 ya era el hallazgo M5 de `SEGURIDAD_2026-11-11.md`. `Report-Only` es a propósito.
- El informe no vio el repo. Por eso no sabía que el modo es intencional.
- Cubre poco. El riesgo real está en roles, solicitudes, pagos y Storage.

## Qué hacer con E-01
- No es bloqueante para abrir.
- Pasar la CSP a enforce solo tras leer los `[csp-report]` de `estured.com` sin violaciones legítimas.
- Quitar `unsafe-inline` exige nonces o hashes. Probar antes Turnstile, mapas y la caché de rutas públicas.
- Runbook: sección I y «Post-producción (seguridad)». Ya figura; no se duplica.

## Verificaciones nuestras pendientes (del punto 03 y 04 del informe)
- Cotejar la versión de Next en `package-lock.json` y en el log del build de Vercel que se promueva a producción.
- Fijar una versión exacta soportada. Hoy `package.json` pide `^15.5.29`.
- Antes de abrir: separación de entornos, RLS y Storage por rol, claves de servicio solo en servidor, cookies de sesión. Ya cubiertos por `PRUEBAS_PRE_PRODUCCION_2026-11-19.md`; repetir contra producción con el checklist del runbook.

## Pentest focalizado (USD 250) — decisión
- Recomendado. Cubre lo que el diagnóstico no tocó.
- Solo contra staging (`estured-dev`). Nunca contra producción.
- Sin claves: ni `SERVICE_ROLE_KEY` ni nada de producción. Alcanzan los usuarios demo.
- Firmar antes NDA y orden de trabajo, como ofrecieron.
- Alcance a pedir (10 endpoints, 2 roles): solicitudes, pagos y comprobantes con rol estudiante y rol residencia. Autorización entre usuarios, acceso a objetos ajenos y Storage.
- Exigir informe con gravedad, evidencia reproducible y remediación.
- Hallazgos ya conocidos y documentados, para no pagar por repetidos: Leaked password protection apagada, `residences.created_by` legible con la clave pública, permisos extra de SELECT en tablas sin policies, `pg_net` en schema `public`, ficha inexistente con HTTP 200 (soft 404), CSP en `Report-Only`, selector demo público en staging (decisión del dueño).

## Servicios descartados por ahora
- 03 Auditoría de código (USD 550): se pisa con la auditoría interna. Reevaluar con usuarios reales.
- 04 Pruebas de carga (USD 400): ya hay k6 propio. Repetir contra producción nueva si hace falta.
- 05 Optimización (USD 450): sin problema de rendimiento comprobado. Depende de los hallazgos del pentest.
