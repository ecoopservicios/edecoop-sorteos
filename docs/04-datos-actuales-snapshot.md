# Snapshot de datos actuales

Fecha de snapshot: 2026-07-23.

Este archivo documenta el estado visible de la base local al momento de crear la documentacion. No incluye hashes de contrasena ni secretos.

## Usuarios actuales

| Nombre | Email | Rol | Activo | Debe cambiar clave |
|---|---|---|---|---|
| Promotora Demo | `promotora@edecoop.local` | `PROMOTER` | Si | No |
| Administrador EDECOOP | `admin@edecoop.local` | `ADMIN` | Si | No |
| Richard Segura | `richard.segura@edesur.com.do` | `ADMIN` | Si | Si |
| Jose Eduardo Perez Almanzar | `jepereza@edesur.com.do` | `ADMIN` | Si | No |

## Claves y usuarios

- Usuarios nuevos creados desde la app usan clave temporal `123456789`.
- La clave temporal obliga cambio al primer acceso.
- Las claves reales no se pueden recuperar desde el hash.
- Para copiar exactamente los usuarios con sus hashes actuales, usar `pg_dump`; ver `08-backup-restauracion-exacta.md`.

## Formulario de afiliacion

| Titulo | Token | Activo | Premio instantaneo |
|---|---|---|---|
| Solicitud de Admision EDECOOP | `LXt569g8B-Oq4ZhQ4wdC57tRX-RKhwtB` | Si | Si |

## Empresas del formulario

| Empresa | Activa |
|---|---|
| EDESUR | Si |
| EDECOOP | Si |
| SANEL / DATA CAMPO | Si |
| SEI CONTRATISTAS | Si |
| LOGIKOS | Si |
| TRANSNEG | Si |

## Tipos de evento actuales

| Codigo | Nombre | Activo |
|---|---|---|
| `AFFILIATION_INSTANT` | Afiliacion Premio Instantaneo | Si |
| `AFFILIATION_FINAL` | Afiliacion Premio Final | Si |

## Eventos actuales

| Evento | Tipo | Mes | Ano | Zonas | Estado | Fecha evento |
|---|---|---:|---:|---|---|---|
| Afiliacion Premio Instantaneo Julio 2026 | Afiliacion Premio Instantaneo | 7 | 2026 | No | `ACTIVE` | 2026-07-01 |
| Afiliacion Premio Final Julio 2026 | Afiliacion Premio Final | 7 | 2026 | No | `ACTIVE` | 2026-07-01 |

## Premios por evento

| Evento | Tipo premio | Premio | Zona | Disponible | Otorgado | Activo |
|---|---|---|---|---:|---:|---|
| Afiliacion Premio Instantaneo Julio 2026 | `ARTICLE` | Sombrilla | - | 35 | 0 | Si |
| Afiliacion Premio Final Julio 2026 | `FINAL` | Laptop | - | 2 | 0 | Si |
| Afiliacion Premio Instantaneo Julio 2026 | `ARTICLE` | Nevera Playera Pequena | - | 44 | 1 | Si |

## Contadores

| Key | Valor |
|---|---:|
| `PRESENTIAL_PARTICIPANT_SEQUENCE` | 32 |

## Totales actuales

| Entidad | Total |
|---|---:|
| Participantes digitales | 1 |
| Enlaces digitales | 0 |
| Solicitudes de afiliacion activas | 0 |
| Premios otorgados | 1 |

## Reportes de ganadores

| Reporte | Fecha | Ganadores cargados |
|---|---|---:|
| Sorteo Padres 2026 | 2026-07-22 | 64 |

## Reconstruccion manual minima

Si no se restaura por dump exacto, crear:

1. Usuarios admin/promotora necesarios.
2. Formulario unico de afiliacion con empresas listadas.
3. Tipos de evento `AFFILIATION_INSTANT` y `AFFILIATION_FINAL`.
4. Eventos de Julio 2026.
5. Premios Sombrilla, Laptop y Nevera Playera Pequena.
6. Contador `PRESENTIAL_PARTICIPANT_SEQUENCE` en `32` si se quiere continuar la secuencia exacta.

Para exactitud real, usar backup/restauracion.
