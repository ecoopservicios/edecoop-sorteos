# Flujos principales

## Flujo de login

1. Usuario entra a `/login`.
2. Ingresa correo y contrasena.
3. Backend valida usuario activo y hash.
4. Se crea cookie `edecoop_session`.
5. Si `mustChangePassword = true`, redirige a `/cambiar-clave`.
6. Si es admin, entra al dashboard.
7. Si es promotora, entra a participacion presencial.

La sesion expira a las 12 horas.

## Flujo de sorteo presencial

1. Usuario entra a Participacion Presencial.
2. Selecciona evento activo.
3. La ruleta muestra premios del evento.
4. Al girar, backend selecciona premio disponible.
5. Crea participante automatico `Participante 000001`, etc.
6. Genera codigo unico.
7. Descuenta inventario.
8. Guarda `RaffleResult`.
9. Muestra resultado.
10. Promotora marca `Entregado` o `Pendiente`.
11. Despues de 1 minuto se limpian datos visuales de la ruleta.

## Flujo de afiliacion virtual publica

1. Persona abre link publico del formulario.
2. Completa datos.
3. Sistema valida campos y duplicados.
4. Guarda `EnrollmentSubmission` con canal `VIRTUAL`.
5. Si `allowInstantPrize = true` y hay premios disponibles, genera enlace de ruleta instantanea.
6. Persona puede participar inmediatamente.
7. Si no hay premios o premio esta deshabilitado, muestra agradecimiento.

## Flujo de afiliacion presencial digital

1. Promotora abre link de afiliacion presencial.
2. Completa formulario por la persona en jornada.
3. Guarda `EnrollmentSubmission` con canal `PRESENTIAL_DIGITAL`.
4. Puede continuar a participacion de premio si aplica.

## Flujo de carga de formularios fisicos

1. Admin/promotora descarga plantilla.
2. Digita formularios en lote.
3. Carga Excel.
4. Sistema valida duplicados.
5. Guarda solicitudes como `PRESENTIAL_FISICO`.
6. Si trae `codigo_premio`, se vincula contra historico de premios.
7. Si no tiene premio, puede alimentar Participacion Virtual para envio de enlaces.

## Flujo de participacion virtual por enlace

1. Admin genera o importa participante.
2. Sistema crea `DigitalParticipant`.
3. Sistema crea `DigitalLink` con token unico.
4. Admin envia WhatsApp desde acciones.
5. Participante abre enlace.
6. Si enlace esta pendiente, puede girar una vez.
7. Al girar:
   - se elige premio disponible,
   - se crea codigo unico,
   - se descuenta inventario,
   - se marca enlace como usado,
   - se guarda `RaffleResult`.

## Flujo de premio final

1. Evento tipo `AFFILIATION_FINAL`.
2. Participan solicitudes de afiliacion de la campana.
3. La seleccion es aleatoria.
4. No importa si la persona ya gano premio instantaneo.
5. Se genera codigo.
6. Se muestra nombre, NIE y premio final.
7. Se guarda resultado.

## Flujo de estado de premio

1. Premio creado queda por defecto como pendiente si no se marca entregado.
2. Admin puede cambiar a:
   - Pendiente.
   - Enviado.
   - Entregado.
3. Entregado desaparece de Estado de Premio y queda en Historico.

## Flujo de ganadores PDF

1. Admin crea reporte.
2. Sube imagen de cabecera.
3. Sube imagen de cierre.
4. Descarga plantilla Excel.
5. Llena columnas:
   - Ref.
   - ID.
   - Nombre.
   - Premio RD$.
   - Localidad.
6. Carga Excel.
7. Genera PDF.
8. PDF ordena por localidad y numera referencias desde 1.
