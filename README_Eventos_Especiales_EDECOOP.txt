README - MODULO FUTURO DE EVENTOS ESPECIALES EDECOOP
====================================================

Objetivo
--------
Disenar una mejora futura para que la plataforma de sorteos de EDECOOP pueda manejar rifas por eventos especiales, sin mezclar participantes, premios ni historicos entre jornadas distintas.

Este modulo debe quedar inicialmente inactivo o controlado por configuracion, para no afectar el funcionamiento actual de la plataforma.


1. Concepto General
-------------------
La plataforma actual maneja sorteos de afiliacion y participacion virtual/presencial. La mejora futura agrega el concepto de EVENTOS ESPECIALES.

Cada evento tendra su propia base de participantes, sus propios premios, su propio inventario y su propio historico.

Ejemplos de eventos:

- Jornada Afiliacion Julio 2026
- Premios Madres 2026
- Premios Padres 2026
- Premios Aniversario 2026
- Otros eventos creados por el administrador

El nombre visible del evento debe incluir el ano para evitar confusiones y proteger el historico.

Ejemplo:

Nombre base: Premios Madres
Ano: 2026
Nombre visible: Premios Madres 2026


2. Tipo de Evento y Edicion Anual
---------------------------------
La estructura correcta debe separar el tipo fijo de evento de la edicion anual.

Tipo de evento fijo:

- Madres
- Padres
- Aniversario
- Afiliacion
- Otro

Edicion anual o jornada:

- Madres 2026
- Madres 2027
- Madres 2028
- Padres 2026
- Aniversario 2026
- Jornada Afiliacion Julio 2026

El tipo de evento permite consultar historicos agrupados.

Ejemplo:

Tipo fijo: Madres
Ediciones:

- Madres 2026
- Madres 2027
- Madres 2028

Cada edicion anual tiene sus propios participantes, premios, zonas, inventario y resultados.

Reglas:

- Los participantes pertenecen a la edicion anual, no solamente al tipo fijo.
- Una persona puede estar en Madres 2026 y tambien en Madres 2027.
- Una persona puede ganar en Madres 2026 y volver a participar en Madres 2027, porque es otra edicion.
- El bloqueo de ganador repetido aplica dentro de la misma edicion anual.
- Las validaciones de duplicados aplican dentro de la misma edicion anual.
- El historico puede consultarse por edicion especifica o por tipo de evento.

Ejemplo:

Consulta por edicion:

- Madres 2026

Consulta historica por tipo:

- Todas las ediciones de Madres: 2026, 2027, 2028, etc.

Recomendacion tecnica:

No crear tablas separadas por ano. Debe existir una sola tabla de participantes de eventos, y cada participante debe apuntar a la edicion anual mediante un campo como eventEditionId.

Esto permite filtrar por ano y tipo sin cambiar la estructura de base de datos cada ano.


3. Estados del Evento
---------------------
Cada evento debe tener estado para controlar su uso.

Estados recomendados:

- Borrador:
  El evento esta creado, pero todavia no permite sorteos.

- Activo:
  El evento permite carga de participantes, asignacion de premios y sorteos.

- Inactivo:
  El evento queda pausado temporalmente. No permite sorteos mientras este inactivo.

- Cerrado:
  El evento finalizo. Solo permite consulta historica.


Regla importante:
Un evento con resultados, premios otorgados o movimientos historicos no debe borrarse libremente. En esos casos debe cerrarse o inactivarse para proteger la trazabilidad.

El borrado solo deberia permitirse si el evento no tiene participantes, premios ni resultados asociados.


4. Creacion del Evento
----------------------
Al crear un evento, el administrador debe indicar como minimo:

- Tipo de evento fijo
- Ano correspondiente
- Nombre visible generado o editable, pero incluyendo el ano
- Si usa zonas o no
- Estado inicial
- Fecha de inicio opcional
- Fecha de cierre opcional

Ejemplos:

- Jornada Afiliacion Julio 2026
- Premios Padres 2026
- Premios Madres 2026
- Premios Aniversario 2026

El sistema debe evitar crear dos eventos con el mismo nombre visible y ano.


5. Zonas
--------
Algunos eventos deben permitir subdivision por zona.

Ejemplos de zonas:

- Norte
- Sur
- Este
- Metropolitana
- Santo Domingo
- Santiago

Las zonas pueden ser reutilizables o asociadas directamente al evento.

Para eventos como Padres, Madres o Aniversario, puede ser necesario que los premios y participantes esten separados por zona.

Reglas:

- Si el evento usa zonas, cada participante debe tener zona.
- Si el evento usa zonas, el sorteo debe filtrar por evento y zona.
- Si el evento usa zonas, el inventario de premios puede dividirse por zona.
- Si el evento no usa zonas, el sorteo trabaja solo por evento.


6. Participantes por Evento
---------------------------
Cada evento debe tener su propia base de participantes.

Esto significa que la base de participantes de Premios Madres 2026 no se mezcla con la base de Premios Padres 2026 ni con una Jornada de Afiliacion.

Campos recomendados para participantes del evento:

- Evento
- Zona, si aplica
- Nombres
- Apellidos
- Cedula o NIE
- Telefono
- Correo electronico opcional
- Fuente de carga
- Fecha de carga
- Estado de participacion interno

Fuente de carga:

- Carga masiva
- Formulario de afiliacion
- Registro manual, si se decide permitirlo

Estado de participacion interno:

- Disponible
- Ganador

No se necesita activo/inactivo para participantes, porque si fueron cargados al evento es porque estan habiles para participar.


7. Carga Masiva de Participantes
--------------------------------
Los participantes de eventos especiales se cargaran principalmente por carga masiva.

Flujo recomendado:

1. El administrador selecciona el evento.
2. El sistema muestra o descarga una plantilla del evento.
3. El administrador carga el archivo.
4. El sistema valida la informacion.
5. Los participantes validos se guardan en la base de ese evento.

Validaciones recomendadas:

- No permitir campos requeridos vacios.
- Validar cedula o NIE segun la regla definida.
- Validar telefono si el campo se exige.
- Validar correo si se incluye.
- Validar que la zona exista cuando el evento use zonas.
- Bloquear duplicados dentro del mismo evento.
- Permitir que una misma persona exista en otro evento distinto.

Ejemplo:

Una persona puede estar en:

- Premios Madres 2026
- Premios Aniversario 2026

Eso no debe bloquearse, porque son eventos distintos.

Pero una misma persona no debe aparecer dos veces dentro de Premios Madres 2026.


8. Regla de Ganador Unico por Evento
------------------------------------
Mientras un evento este activo, un participante ganador no debe volver a salir ganador en ese mismo evento.

Regla del sorteo:

El sistema debe filtrar participantes por:

- Evento activo
- Zona, si el evento usa zonas
- Participante con estado Disponible

Cuando el participante gana:

1. Se crea el resultado historico.
2. Se marca el participante como Ganador.
3. Se descuenta el inventario del premio correspondiente.
4. Se genera un codigo unico del premio.

Un participante marcado como Ganador queda excluido de nuevos sorteos dentro del mismo evento.

Esta regla aplica mientras el evento este activo y tambien protege el historico despues del cierre.


9. Premios por Evento
---------------------
Los premios deben poder asociarse a eventos.

Campos recomendados:

- Evento
- Zona, si aplica
- Nombre del premio
- Cantidad disponible
- Estado del premio
- Fecha de creacion

Si el evento usa zonas, el inventario puede manejarse por zona.

Ejemplo:

Evento: Premios Padres 2026
Zona: Norte
Premio: Bono RD$1,000
Cantidad disponible: 25

Evento: Premios Padres 2026
Zona: Sur
Premio: Bono RD$1,000
Cantidad disponible: 25

Si el evento no usa zonas, el premio solo depende del evento.


10. Sorteo por Evento
--------------------
El modulo de sorteo de eventos especiales debe permitir:

- Seleccionar evento activo.
- Seleccionar zona si el evento usa zonas.
- Sortear solo entre participantes disponibles de ese evento/zona.
- Asignar premio disponible del evento/zona.
- Marcar ganador para que no vuelva a salir.
- Guardar historico completo.

Modalidades posibles:

A. Sorteo de participante ganador:
   El sistema elige un ganador desde la base de participantes del evento.

B. Sorteo de premio para participante:
   Se conoce el participante y el sistema asigna un premio.

Para eventos como Madres, Padres o Aniversario, se recomienda principalmente la modalidad A.


11. Afiliacion como Evento
--------------------------
La afiliacion debe poder integrarse con eventos para blindar las jornadas.

Ejemplo:

Evento: Jornada Afiliacion Julio 2026

Cuando una persona completa el formulario de afiliacion:

1. Se guarda la solicitud de afiliacion como ya ocurre actualmente.
2. Si existe una jornada de afiliacion activa, se copia tambien como participante de ese evento.
3. Esa persona participa solo en esa jornada especifica.

Esto permite que las personas que completaron el formulario durante una jornada especifica queden asociadas a esa base y no se mezclen con otras jornadas.

Tambien debe permitirse cargar participantes masivos en una jornada de afiliacion especifica.

Ejemplo:

- Jornada Afiliacion Julio 2026
- Jornada Afiliacion Agosto 2026

Cada jornada tendra su propia base de participantes y su propio historico.


12. Historico
-------------
El historico debe guardar snapshot de la informacion importante para que no se rompa aunque cambien o se eliminen datos maestros.

Cada resultado debe guardar:

- Id del evento
- Nombre del evento
- Ano del evento
- Zona
- Participante
- Cedula o NIE
- Telefono
- Correo, si aplica
- Premio otorgado
- Codigo unico
- Fecha y hora
- Usuario responsable
- Estado del premio

El historico no debe depender completamente de que el premio, participante o evento sigan editables.

Si se cierra un evento, los resultados deben poder consultarse sin mezclarse con otros eventos.


13. Permisos
------------
Administrador:

- Crear eventos
- Editar eventos
- Activar/inactivar/cerrar eventos
- Borrar eventos sin movimiento
- Crear zonas
- Cargar participantes
- Crear premios por evento
- Ver historicos
- Consultar reportes

Promotora o usuario limitado:

- Acceder solo al sorteo del evento habilitado
- Seleccionar zona si aplica y si el flujo lo requiere
- Realizar sorteo
- Ver resultado y codigo unico


14. Reportes Futuros
--------------------
Reportes recomendados:

- Participantes cargados por evento
- Participantes por zona
- Ganadores por evento
- Ganadores por zona
- Premios entregados
- Premios pendientes
- Inventario restante por evento
- Inventario restante por zona
- Historico por ano
- Historico por tipo de evento


15. Modo Inactivo Inicial
-------------------------
Esta mejora debe poder quedar apagada inicialmente para no afectar el sistema actual.

Recomendacion tecnica:

Usar una configuracion o variable:

EVENT_MODE_ENABLED=false

Mientras este apagado:

- La plataforma sigue usando la logica actual.
- Los premios globales siguen funcionando.
- La participacion presencial y virtual actual no se modifica.
- El formulario de afiliacion actual sigue funcionando.

Cuando se active:

- Se muestra el modulo Eventos Especiales.
- Se habilita la carga de participantes por evento.
- Se habilitan premios por evento.
- Se habilita sorteo por evento/zona.


16. Modelo de Datos Sugerido
----------------------------
Tablas futuras sugeridas:

EventType
- id
- name
- isActive
- createdAt
- updatedAt

EventEdition
- id
- eventTypeId
- year
- displayName
- status
- usesZones
- startsAt
- endsAt
- createdAt
- updatedAt

EventZone
- id
- eventEditionId
- name
- isActive
- createdAt
- updatedAt

EventParticipant
- id
- eventEditionId
- zoneId
- firstName
- lastName
- documentId
- employeeNumber
- phone
- email
- source
- participationStatus
- loadedAt
- wonAt

EventPrize
- id
- eventEditionId
- zoneId
- name
- totalQuantity
- availableQuantity
- isActive
- createdAt
- updatedAt

EventRaffleResult
- id
- eventEditionId
- eventTypeNameSnapshot
- eventNameSnapshot
- eventYearSnapshot
- zoneNameSnapshot
- participantId
- participantNameSnapshot
- participantDocumentSnapshot
- participantPhoneSnapshot
- participantEmailSnapshot
- prizeId
- prizeNameSnapshot
- code
- status
- responsibleUserId
- createdAt


17. Reglas Clave
----------------
- Debe existir un tipo fijo de evento, por ejemplo Madres, Padres, Aniversario o Afiliacion.
- Cada tipo fijo puede tener ediciones anuales o jornadas.
- Una edicion debe tener ano.
- El nombre visible de la edicion debe incluir el ano.
- Un evento activo permite sorteos.
- Un evento inactivo no permite sorteos.
- Un evento cerrado solo permite consulta.
- No se debe borrar un evento con historico.
- Los participantes se cargan por edicion anual.
- La misma persona puede existir en ediciones diferentes.
- La misma persona no debe duplicarse dentro de la misma edicion.
- Un ganador no puede volver a ganar dentro de la misma edicion.
- Si el evento usa zonas, el sorteo filtra por zona.
- Los premios deben pertenecer a la edicion.
- El historico debe guardar snapshots.
- Afiliacion puede copiar solicitudes al evento de afiliacion activo.


18. Prioridad de Implementacion
-------------------------------
Fase 1:
- Crear modelo de eventos.
- Crear estados de evento.
- Crear zonas por evento.
- Dejar modulo apagado por configuracion.

Fase 2:
- Carga masiva de participantes por evento.
- Validaciones de duplicados por evento.
- Consulta de participantes cargados.

Fase 3:
- Premios por evento y zona.
- Inventario por evento.

Fase 4:
- Sorteo por evento/zona.
- Bloqueo de ganador repetido.
- Historico por evento.

Fase 5:
- Integracion con afiliacion.
- Copiar solicitudes de afiliacion al evento activo de afiliacion.

Fase 6:
- Reportes por evento, ano y zona.


19. Nota Final
--------------
Este documento describe una mejora futura para eventos especiales. La implementacion debe hacerse sin romper la logica actual de sorteos, premios, participacion virtual, participacion presencial ni formulario de afiliacion.

La clave del diseno es aislar cada evento con su propia base de participantes, premios e historico, usando el ano como parte esencial de la identidad del evento.
