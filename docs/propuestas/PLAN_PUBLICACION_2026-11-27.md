# Salida a producción de «pesos y pago» (DR72–DR74)

**Estado al 2026-11-27 19:35:** `150c334` listo para publicar. Nada enviado.
Texto de los mails: `AVISO_TERMINOS_2026-11-27.md`, ya con la fecha.

`main` antes de publicar = `89f8544` (mails, publicados a las 19:19).

## Publicar hoy

```bash
git push origin 150c334:main
```

Es el único comando vigente.
`150c334` une `eca0a46` y `89f8544` (rama local `publicar/pesos-2026-11-27`). Mismos archivos que `eca0a46`.
El push de `eca0a46` fue rechazado: `main` había avanzado.
Condición: la cuenta creada a las 18:42 es tuya. Si no, avisale antes.

El modo preapertura no se probó antes de publicar. Staging corre sin `PREAPERTURA`.
Vuelta atrás: *Instant Rollback* en Vercel.

Después:

1. [Yo] Verifico en `estured.com`: `/`, popup, `/preregistro`, `/fundadoras`, footer y redirección de `/search`.
2. [Yo] Verifico `/terms`, `/terms/residencias`, `/email/*.png` y logs.
3. [Vos] Hacé un alta de prueba. Confirmá que llega la bienvenida.
4. [Vos] Pegá en Supabase `docs/mail/recuperar-contrasena.html` de `eca0a46`.

Queda fuera: `9966802` (campos nuevos en 45 archivos, sin validar).

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
- **Cron:** las 6 respuestas guardadas son `401`. Revisar `cron_secret` en Vault antes de abrir.
- Cron y push en dispositivo: sin probar.

## Decisiones tomadas

- Las 2 cuentas de la mañana eran pruebas del dueño. Ya no están.
- Rige el 27/11 (dueño). Sin destinatarios reales: no se enviaron mails.
- Fecha visible en `/terms`: 27 de noviembre. Coincide.
- En preapertura rige la sección «Términos de la preapertura» de `/terms`. El resto aplica al abrir.
- Las ramas `publicar/web-*` quedan sin uso. No correr sus comandos.
- *Instant Rollback* también devuelve los textos legales anteriores.

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
