# Operacion por pestanas

## Dashboard

No almacena datos nuevos. Resume:

- Evento seleccionado.
- Participantes.
- Premios configurados.
- Disponibles.
- Premios entregados.
- Presenciales.
- Virtuales.
- Pendientes.
- Enviados.
- Entregados.
- Resumen por premio del evento.

## Participacion Presencial

Guarda resultados de ruleta presencial:

- Participante automatico.
- Codigo unico.
- Premio.
- Evento seleccionado.
- Promotora/usuario responsable.
- Fecha y hora.
- Estado del premio.

Tambien descuenta inventario del premio asociado.

## Eventos

Administra:

- Crear eventos.
- Configuracion de eventos.
- Tipos de evento.
- Zonas.
- Premios por evento.
- Participantes por evento.
- Eventos historicos.
- Reset de eventos.

Guarda:

- Tipos de evento.
- Ediciones por mes/ano.
- Premios asociados.
- Participantes cargados.
- Estados activo/inactivo/cerrado.

## Historico

Consulta y conserva:

- Premios otorgados.
- Codigo unico.
- Participante.
- Telefono/correo/NIE si aplica.
- Premio snapshot.
- Evento snapshot.
- Ambiente: presencial o digital.
- Responsable.
- Estado.
- Fecha y hora.

Tambien sirve como registro definitivo para premios entregados.

## Estado de Premio

Muestra premios no cerrados en historico.

Permite cambiar estado:

- Pendiente.
- Enviado.
- Entregado.

Cuando pasa a entregado, deja de mostrarse aqui y queda consultable desde Historico.

## Participacion Virtual

Administra participantes con enlace de premio instantaneo:

- Nombre.
- Apellido.
- NIE.
- Correo.
- Celular.
- Enlace unico.
- Estado del enlace.

Actualmente recibe participantes desde afiliaciones que no tienen premio recibido y quedan listos para enviar enlace.

## Formularios de Afiliacion

Contiene:

- Afiliacion presencial digital.
- Carga de formularios fisicos.
- Afiliacion virtual con link y QR.
- Solicitudes recibidas.
- Configuracion del formulario.
- Empresas editables.

Guarda solicitudes con canal:

- `VIRTUAL`: llenado por link publico.
- `PRESENTIAL_DIGITAL`: llenado por promotora en web.
- `PRESENTIAL_FISICO`: formulario fisico cargado masivamente.

## Bitacora

Guarda auditoria:

- Usuario.
- Accion.
- Entidad.
- Motivo/comentario.
- Metadata.
- Fecha.

Debe usarse para eliminaciones, resets y cambios importantes.

## Ganadores

Modulo independiente del sorteo operativo.

Guarda:

- Reportes.
- Imagen de cabecera.
- Imagen de cierre.
- Tabla de ganadores cargada por Excel.

Genera:

- PDF con cabecera.
- Tabla ordenada por localidad.
- Numeracion de pagina.
- Imagen de cierre.

## Usuarios

Guarda y administra usuarios:

- Crear.
- Editar.
- Activar/inactivar.
- Reset de clave.
- Rol.

Clave temporal por defecto:

```text
123456789
```

## Reportes

Vista de consulta consolidada. Resume informacion operativa del sistema y puede ampliarse para exportaciones futuras.
