# Salida a producción de «pesos y pago» (DR72–DR74)

**Estado al 2026-11-27 22:20:** publicado y alta probada. Mails de aviso sin enviar.
Texto de los mails: `AVISO_TERMINOS_2026-11-27.md`, ya con la fecha.

## Publicación

- El dueño corrió `git push origin 150c334:main`.
- `150c334` une `eca0a46` y `89f8544` (mails, publicados a las 19:19). Mismos archivos que `eca0a46`.
- El primer intento, con `eca0a46`, fue rechazado: `main` había avanzado.
- Deploy `dpl_ApeXsq5Dv785uCc3epjW64MVpLPM`: `READY` en `gru1`, alias `estured.com`.
- `main` mergeado en `staging` (`1b844ea`, sin cambios de archivos).

## Verificación en `estured.com` (navegador limpio, sin enviar formularios)

| Control | Resultado |
|---|---|
| Celular (390) y escritorio (1366): 11 rutas | 200, sin scroll horizontal |
| `/search` | Redirige a `/preregistro` |
| `/terms` y `/terms/residencias` | 27 de noviembre, con «queda fija» |
| Popup, `/preregistro`, fundadoras, footer | Vistos en capturas |
| Popup de alta | Sin scroll; muestra el anti-bots |
| 7 imágenes de `/email/` | 200 |
| Meta sin aceptar cookies | Sin pedidos |
| Logs de error y aviso del deploy | Sin registros |

- Consola: errores en páginas con anti-bots (CSP `data:` y un 400 externo). Sin comparar con el deploy anterior.
- La CSP citada en el error no es la de `estured.com`: viene del marco del anti-bots.
- Sin probar: alta real, mail de bienvenida, teclado en teléfono, cron y push.

## Alta de prueba y pendientes (22:20)

Producción sirve `8ef6faf` (Pixel, 20:26). El alta se hizo sobre ese deploy.

| Control | Resultado |
|---|---|
| Alta 22:11 | Cuenta creada; 2 en total |
| Bienvenida | *Delivered*; número de registro 14 |
| Cupo Resend tras el alta | 1 de 100 |
| Logs 22:10 | `refresh_token_not_found`, tratado como sesión cerrada |
| Cron a las 22:00 | `401`: Vault guardaba el texto de relleno |
| Cron a las 23:00, con secreto nuevo | `200`, 19 tareas sin errores |
| SMTP de Supabase | Apagado: recuperar contraseña no llega a usuarios reales |
| Teclado en teléfono real | Sin probar. El simulador tampoco arrancó: falta Xcode completo |

1. [Vos o Yo] Vaciá la descripción de `cron_secret`: tiene el secreto en texto.
2. [Vos] Activá SMTP propio con una key nueva (runbook §D3).
3. [Yo] Pego la plantilla cuando haya SMTP.
4. [Vos] Decidí el retiro de la opción C.

## Validación de `eca0a46`

| Control | Resultado |
|---|---|
| Typecheck, lint, build, `npm audit` | Pasan |
| Suite completa | 3143 pasan, 1 falla, 10 salteados |
| Archivos con fallo | `expireContactEstablished`, `expireNegotiationProposals` |
| Esos 2 en `main` (`4f82924`) | Fallan igual: datos demo de Lucía |
| Deploy de staging de `eca0a46` | `READY` |
| Páginas vistas en `estured.vercel.app` | Con `82fa96d`, igual salvo docs |

## Base de prod (solo lectura)

- Columnas de la migración 0112: presentes.
- Solicitudes de reserva: 0.
- Cuentas: 1 estudiante, creada 27/11 18:42. La sesión de Meta la informa como prueba del dueño.
- Solicitudes de residencia sin descartar: 0.
- **Cron:** `401` hasta las 22:00; `200` a las 23:00.
- Push en dispositivo: sin probar.

## Decisiones tomadas

- Las 2 cuentas de la mañana eran pruebas del dueño. Ya no están.
- Rige el 27/11 (dueño). Sin destinatarios reales: no se enviaron mails.
- Fecha visible en `/terms`: 27 de noviembre. Coincide.
- En preapertura rige la sección «Términos de la preapertura» de `/terms`. El resto aplica al abrir.
- Las ramas `publicar/web-*` quedan sin uso. No correr sus comandos.
- *Instant Rollback* solo llega al deploy anterior, con el secreto viejo del cron. Deshacer pesos y pago pide un commit que lo revierta.

## Destinatarios contados a la mañana

| `consent_type` | Personas | Mail |
|---|---|---|
| `terms` | 2 (pruebas del dueño) | 1 |
| `residence_terms` | 0 | 2: sin destinatarios |

## Envío, si hay destinatarios (requiere OK)

- Cupo Resend: 100 por día. Usados al consultar: 13. Se reinicia 20:59 (Argentina).
- Cupo mensual: 13 de 3000.
- Canal: conector de Resend, un envío por persona. Reemplaza la copia oculta.
- Para enviar, leo en prod las direcciones. Hasta hoy solo conté.
- Alternativa: los mandás vos desde `hola@`, con copia oculta.
- Remitente `EstuRed <no-reply@estured.com>`, respuesta a `hola@estured.com`.
- Plantilla con la marca (`lib/email/layout.ts`).
- Primero una prueba a `hola@`. Después el envío. Después control de entrega.
- Con más de 70 destinatarios: tandas de 70 por día. Quedan 30 para mails automáticos.
- La fecha debe ser posterior a la última tanda.

## Verificación previa a publicar

| URL | `/terms` | `/terms/residencias` |
|---|---|---|
| `estured.vercel.app` | 27 de noviembre, con «queda fija» | 27 de noviembre |
| `estured.com` | 25 de noviembre | 22 de noviembre |
