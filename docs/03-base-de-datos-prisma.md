# Base de datos y Prisma

El schema principal esta en:

```text
prisma/schema.prisma
```

## Modelos principales

### User

Usuarios del sistema.

Campos clave:

- `name`
- `email`
- `passwordHash`
- `mustChangePassword`
- `role`: `ADMIN` o `PROMOTER`
- `isActive`

Reglas:

- El email es unico.
- Usuarios nuevos usan clave temporal `123456789`.
- Si `mustChangePassword` es `true`, se redirige a cambio de clave.

### EventType

Tipos de evento.

Ejemplos actuales:

- `AFFILIATION_INSTANT`: Afiliacion Premio Instantaneo.
- `AFFILIATION_FINAL`: Afiliacion Premio Final.

### EventEdition

Evento concreto por tipo, mes y ano.

Ejemplo:

- Afiliacion Premio Instantaneo Julio 2026.
- Afiliacion Premio Final Julio 2026.

Campos clave:

- `eventTypeId`
- `month`
- `year`
- `displayName`
- `usesZones`
- `status`: `ACTIVE`, `INACTIVE`, `CLOSED`
- `eventDate`

Regla:

- No se repite el mismo tipo de evento para el mismo mes y ano.

### EventPrize

Premios asociados a un evento.

Campos clave:

- `eventEditionId`
- `type`: `BONUS`, `ARTICLE`, `FINAL`
- `name`
- `zone`
- `availableQuantity`
- `awardedQuantity`
- `isActive`

Reglas:

- La cantidad otorgada se alimenta del historico/resultados.
- Si un evento se inactiva, sus premios tambien deben quedar inactivos.
- El premio final usa tipo `FINAL`.

### EventParticipant

Participantes cargados para eventos especiales.

Campos:

- `eventEditionId`
- `zone`
- `firstName`
- `lastName`
- `documentId`
- `employeeNumber`
- `phone`
- `email`
- `source`
- `status`

Uso futuro:

- Eventos de madres, padres, aniversario, etc.
- Separacion por zona.
- Evitar que un ganador salga dos veces dentro del mismo evento.

### EnrollmentForm

Formulario unico de afiliacion.

Campos clave:

- `token`
- `title`
- `description`
- `isActive`
- `allowInstantPrize`

`allowInstantPrize` controla si al completar el formulario publico se habilita premio instantaneo.

### EnrollmentCompany

Lista editable de empresas del formulario.

Campos:

- `formId`
- `name`
- `isActive`

### EnrollmentSubmission

Solicitudes de afiliacion recibidas.

Campos clave:

- Datos personales.
- Datos laborales.
- Banco/cuenta.
- `channel`: `VIRTUAL`, `PRESENTIAL`, `PRESENTIAL_DIGITAL`, `PRESENTIAL_FISICO`
- `receivedPrize`
- `prizeCode`
- `raffleResultId`
- `eventEditionId`
- `digitalParticipantId`
- `digitalLinkId`
- `deletedAt`, `deletedById`, `deleteReason`

Reglas:

- Validacion contra duplicados por cedula, NIE/numero de empleado, correo y telefono.
- Las cargas fisicas pueden traer codigo de premio ya recibido.
- Si no hay premio recibido, pueden quedar disponibles para participacion virtual.

### DigitalParticipant

Participantes registrados para enlace virtual.

Campos:

- `firstName`
- `lastName`
- `nie`
- `email`
- `phone`
- `name`

Reglas:

- `phone` unico.
- `nie` unico.
- `name` unico cuando coincide exactamente.

### DigitalLink

Enlaces unicos de participacion.

Campos:

- `token`
- `participantId`
- `createdById`
- `status`: `PENDING`, `USED`, `EXPIRED`, `CANCELLED`
- `usedAt`
- `expiresAt`

Reglas:

- Un enlace solo puede usarse una vez.
- Si esta usado, se bloquea WhatsApp, edicion y eliminacion; eliminacion puede requerir comentario segun flujo.

### RaffleResult

Historico de premios otorgados.

Campos clave:

- `code`
- `participantName`
- `participantPhone`
- `participantNie`
- `participantEmail`
- `environment`: `PRESENTIAL` o `DIGITAL`
- `prizeId`
- `prizeName`
- `eventEditionId`
- `eventTypeName`
- `eventName`
- `eventMonth`
- `eventYear`
- `eventDate`
- `status`: `PENDING`, `SENT`, `DELIVERED`, etc.

Reglas:

- Guarda snapshot del premio y evento.
- No debe romperse si el premio original se elimina.
- Los entregados salen de Estado de Premio y quedan en Historico.

### AuditLog

Bitacora.

Guarda:

- Accion.
- Modulo/entidad.
- ID de entidad.
- Motivo.
- Usuario.
- Metadata.
- Fecha.

### WinnerReport y WinnerReportEntry

Modulo independiente de ganadores para PDF.

`WinnerReport` guarda:

- Nombre del reporte.
- Fecha.
- Imagen de cabecera.
- Imagen de cierre.

`WinnerReportEntry` guarda:

- Referencia.
- ID.
- Nombre.
- Premio.
- Localidad.

Reglas:

- La tabla se carga desde Excel.
- El PDF ordena por localidad.
- La referencia se imprime de 1 al total.
- El valor del premio se formatea con coma de miles.
