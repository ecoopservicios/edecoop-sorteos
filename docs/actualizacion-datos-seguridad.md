# Actualizacion de datos: flujo publico

- Una pregunta por pantalla: empresa, consulta, cedula de validacion si se consulta por empleado, nombre, telefono, disponibilidad de WhatsApp, otro telefono de WhatsApp si corresponde, correo, contacto de emergencia, telefono de emergencia, relacion, preguntas personalizadas y resumen.
- La consulta por empleado no devuelve identidad hasta validar la cedula de la misma fila. La consulta directa por cedula puede mostrar el nombre sin solicitar otro identificador.
- El servidor firma una prueba de identidad que vence a las dos horas. El envio comprueba socio, consulta y cedula contra esa prueba y la base actual.
- Un envio por socio, incluyendo registros anteriores y otras filas con la misma cedula. Un bloqueo transaccional de PostgreSQL evita duplicados simultaneos entre replicas.
- Tras completar, una cookie de sesion HttpOnly y firmada mantiene la confirmacion al recargar e impide iniciar otro envio en esa sesion. La prueba del recibo vence a las 12 horas; la regla por socio no vence.
- WhatsApp admite SAME, OTHER y NONE. NONE guarda el telefono vacio y `customResponses.whatsappPreference = "NONE"`; no inventa un telefono. El panel y el Excel muestran "No tiene WhatsApp".
- Contra abuso: 120 consultas por IP cada 15 minutos y 60 intentos de envio por IP cada hora. Respuesta 429 con Retry-After. Los contadores se guardan bajo `dataUpdate.rateLimit.*` en AppSetting, son transaccionales y sobreviven a reinicios. Solo se almacena un HMAC de la IP, nunca la IP en claro.
- En Railway se usa X-Real-IP del proxy publico, no X-Forwarded-For aportado por el cliente. Referencia: https://docs.railway.com/networking/public-networking/specs-and-limits
- Sin migracion de esquema ni modificacion de entregas de souvenir o contactos existentes.

## Pruebas locales

`scripts/test-data-update-wizard.cjs` requiere una base y servidor en localhost. Crea socios temporales, restaura la configuracion de preguntas y elimina sus solicitudes y auditorias al terminar. Cubre movil y escritorio, tres modalidades de WhatsApp, identidad, formulario por pregunta, reintentos, recibo, firma, duplicados concurrentes y limite por IP. TEST_BASE_URL permite probar una compilacion local de produccion.
