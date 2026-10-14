# Entrega de Souvenir

Proyecto local independiente de los sorteos, afiliaciones y actualización de datos. Un socio del listado propio `SouvenirMember` puede recibir un souvenir fijo una sola vez. Solo comparte la configuración de empresas y su tipo de identificación.

## Flujo

1. Al entrar se muestran dos opciones: **Cargar listado de socios** y **Entregar Souvenir**. La primera abre carga y plantilla, sin seleccionar empresa. El Excel incluye empresa en cada fila y puede contener varias empresas.
2. **Entregar Souvenir** abre selección de empresa y después el diálogo **Buscar socio**. La empresa se recuerda durante la sesión del navegador. Al volver a entrar o recargar se muestran las dos opciones iniciales.
3. Buscar por cédula o número de empleado según `EnrollmentCompany.dataUpdateLookupField`. No depende de que esté habilitada la actualización de datos. El diálogo de búsqueda se abre limpio después de cancelar o entregar y mantiene la empresa hasta presionar **Cambiar de empresa**.
4. Mostrar nombre, empresa, identificación, dirección organizativa y página del listado físico.
5. Confirmar con **Entregado**, o cancelar. Ambas acciones limpian el buscador y conservan la empresa.
6. Una entrega existente muestra fecha y responsable y bloquea una nueva confirmación.

Administrador y promotora pueden buscar y entregar. Solo el administrador puede cargar el listado Excel. Cada empresa muestra total de socios del listado propio, entregados y pendientes, filtro por estado y descarga Excel.

## Datos

- `SouvenirMember` guarda nombres, apellidos, identificaciones, empresa, dirección y página física. No consulta ni actualiza `MemberDirectory` o solicitudes de afiliación.
- `SouvenirDelivery.souvenirMemberId` es único para bloquear entregas repetidas y concurrentes.
- La entrega conserva una copia de los datos del socio y usuario responsable; las actualizaciones del listado no modifican esa constancia.
- Confirmación y bitácora se guardan en una transacción.
- La carga Excel crea socios nuevos o completa los existentes por identificación dentro de su empresa. Rechaza identificaciones contradictorias, duplicados en el archivo y datos inválidos. Si hay errores, no guarda el archivo parcialmente.
- Columnas en este orden: `NOMBRES`, `APELLIDOS`, `CEDULA CONSULTA`, `CEDULA MOSTRAR`, `NO EMPLEADO`, `EMPRESA`, `SEXO`, `OFICINA`, `UNIDAD`. La segunda hoja de la plantilla incluye las empresas configuradas. Cédula de consulta: 11 dígitos; empleado: uno o más dígitos, sin límite de longitud. Conservar ceros iniciales mediante celdas de texto.
- `CEDULA CONSULTA` se utiliza exclusivamente para identificar. `CEDULA MOSTRAR` admite el texto o máscara que se mostrará en tabla, resultados y exportación. No se utiliza para buscar ni para comprobar duplicados. La respuesta de búsqueda no incluye la cédula de consulta.
- Dirección y página de registros anteriores se conservan, pero ya no se exigen en esta plantilla de nueve campos.
- La carga analiza duplicados de cédula de consulta, número de empleado y nombre completo normalizado en todo el listado de souvenirs, aunque las filas correspondan a empresas diferentes. CÉDULA MOSTRAR no interviene en la unicidad porque puede contener máscaras repetidas.
- Una fila correspondiente al mismo socio existente puede actualizar sus datos sin crear otra fila ni reiniciar su entrega. Una identidad que pertenezca a otro socio o empresa bloquea el archivo. PostgreSQL también protege la unicidad frente a cargas simultáneas.
- El resultado del archivo muestra empresas, total de socios, socios por empresa, cuántos consultan por empleado o cédula y cuántos tienen vacío el dato requerido. La modal consulta además el listado ya cargado y muestra incidencias de identificación vacía o duplicados, sin modificar esos registros.
- La carga requiere dos pasos: **Analizar archivo** (solo lectura) y **Aplicar carga** (guardado). El segundo botón solo se habilita con análisis válido. Cambiar o quitar el archivo invalida el análisis. Al aplicar, el servidor verifica el hash del archivo y repite las validaciones contra los registros actuales antes de guardar la transacción.
- Nombres y apellidos se guardan tal cual aparecen en el Excel, sin restricciones de caracteres, longitud o cantidad de letras, sin recortar espacios ni convertir mayúsculas o acentos. Solo se compara el nombre completo para evitar duplicados: esta comparación ignora acentos, mayúsculas, espacios repetidos y variantes de apóstrofes/guiones, pero distingue Ñ de N. Los nombres pueden actualizarse para la misma identificación. El número de empleado acepta uno o más dígitos sin límite de longitud y conserva ceros iniciales en carga y búsqueda; rechaza letras o símbolos. Estas reglas solo corresponden a Souvenir.

## Local

El análisis de empresas acepta diferencias de acentos, mayúsculas y espacios repetidos. Para nombres parecidos propone coincidencias mediante distancia de edición, sin elegir automáticamente. Muestra nombre recibido, filas afectadas, sugerencias y selector de empresa correcta. Las empresas nuevas, eliminadas, inactivas o sin identificación se distinguen y deben agregarse/recuperarse/configurarse desde Configuración, o asociarse explícitamente con una empresa vigente. No se crean empresas desde el Excel. Cualquier cambio de asociación invalida el análisis; se debe analizar nuevamente. El guardado vuelve a consultar la configuración y validar las asociaciones, que quedan en bitácora.

La carga de socios abre la página `/entrega-souvenir/carga`, no una modal. Empresa, búsqueda y confirmación de entrega mantienen diálogos compactos.

Las tablas del proyecto usan `SouvenirTable`: sin scroll interno ni ancho mínimo que obligue a desplazamiento horizontal. En escritorio las columnas se ajustan y envuelven el texto; en móvil cada registro muestra todos sus campos etiquetados. Los listados se paginan de diez en diez. Los filtros reinician la página del detalle y la descarga Excel incluye todos los resultados filtrados, no solo la página visible.

El inicio incluye Consultar listado (`/entrega-souvenir/listado`) y Estado de Entrega (`/entrega-souvenir/estado`). Ambos tienen filtros de empresa, nombre/empleado/cédula de consulta y estado, así como Excel con resumen y detalle. Las cantidades generales del listado no cambian con los filtros; el resumen de Estado de Entrega corresponde a sus filtros.

La carga ordena primero por empresa (EDESUR antes que las demás), luego por oficina, unidad y apellidos/nombres. Después asigna una secuencia global continua a `SouvenirMember.listNumber`. Al aplicar otra carga se recalcula la secuencia; filtrar o separar las oficinas no la reinicia. Carga, búsqueda, Excel y PDF usan ese mismo número y orden. Las entregas conservan su número histórico como snapshot. No se exige una columna de numeración en el Excel de entrada. `scripts/order-souvenir-local.cjs` aplica y verifica este orden en una base local existente.

Imprimir listado (`/entrega-souvenir/imprimir`) usa exclusivamente socios del listado actual. Agrupa por OFICINA, ordena por número de listado y comienza cada oficina en una hoja independiente. Hay filtros de empresa y oficina. El encabezado de cada hoja indica Entrega de Souvenir Aniversario EDECOOP, oficina y cantidad total de socios de esa oficina. Columnas: No., Nombres, Apellidos, Cédula (CEDULA MOSTRAR), No. empleado, Empresa, Firma. El formato es Carta horizontal, con recuadro amplio de firma y paginación por oficina. Descargar PDF genera un único documento horizontal con todas las empresas y oficinas seleccionadas, sin ZIP ni archivos separados. Cada oficina empieza en una página nueva; la numeración de páginas es continua para todo el documento. Cada PDF repite encabezados y calcula saltos de página según el texto de cada fila. Las fuentes Bitstream Vera y su licencia están incluidas en `public/fonts`. Los datos y las entregas no se modifican al imprimir.

El proyecto se llama Souvenir Aniversario. Limpiar listado solo está en Consultar listado y es exclusivo del administrador; requiere escribir LIMPIAR y motivo. Permite todo el listado o una empresa. Borra físicamente las filas de `SouvenirMember`, sin copia del listado ni soft-delete. `SouvenirDelivery` tiene relación opcional con `onDelete: SetNull` y conserva los datos de entregas realizadas, incluyendo empresa, identificación, nombre, fecha y responsable. Estado de Entrega muestra pendientes del listado actual y entregas históricas, sin duplicarlas cuando un socio se carga de nuevo. Las entregas previas protegen contra una segunda entrega, pero no bloquean cargar el listado. La bitácora de limpieza contiene únicamente motivo, empresa y cantidad, no una copia de socios.

`scripts/finalize-souvenir-cleanup-local.cjs` conserva los campos necesarios de entregas anteriores y elimina definitivamente los socios que quedaron retirados por la implementación anterior. Solo acepta base local; se ejecutó al aplicar esta corrección. No genera respaldos.

Eliminar una empresa desde Configuración requiere confirmación y registra `EnrollmentCompany.deletedAt`, sin borrar la fila ni cambiar su estado o reglas de consulta. Desaparece de configuración y de nuevas afiliaciones; los listados de socios, actualizaciones recibidas y entregas conservan sus relaciones. Los listados existentes siguen siendo consultables. Agregar explícitamente el mismo nombre recupera la empresa con su ID original. La operación queda registrada en bitácora.

URL: `http://localhost:3002/entrega-souvenir`.

Dentro del PDF único, cada oficina de EDESUR se subdivide por UNIDAD. Cada unidad comienza en una página nueva, repite su nombre y cantidad de socios en todas sus páginas y conserva la numeración global del listado. Las unidades sin nombre aparecen como SIN UNIDAD ASIGNADA. La paginación corresponde al documento completo. No se generan archivos separados por unidad. La vista previa y la impresión del navegador aplican la misma separación. Otras empresas siguen agrupadas únicamente por oficina. Prueba específica: `node scripts/test-souvenir-print-units.cjs`.

El proyecto utiliza la convención existente `npx prisma db push` para sincronizar el esquema; no ejecuta migraciones en producción automáticamente desde la pantalla.

Para convertir la primera versión local que usaba la base compartida, `node scripts/separate-souvenir-list-local.cjs` separa los datos en una transacción y conserva entregas previas y sus socios. No copia al resto de la base compartida. Este script solo acepta localhost y ya se ejecutó en esta base local.

Prueba de integración: `node scripts/test-souvenir-local.cjs` con Playwright disponible mediante `NODE_PATH` y Microsoft Edge instalado. Solo acepta PostgreSQL en localhost, crea sus propios datos de prueba y los elimina al finalizar. Comprueba permisos, empresa, concurrencia, importación, conservación del snapshot, cancelar/entregar, recarga y tamaños móvil/escritorio. Capturas en `outputs/` (ignorado por Git).
