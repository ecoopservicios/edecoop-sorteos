# EDECOOP Sorteos - Indice de continuidad

Este directorio contiene la documentacion necesaria para que otro chat, desarrollador o equipo pueda retomar el proyecto sin depender del historial de conversacion.

## Archivos de documentacion

1. `01-resumen-ejecutivo.md`
   - Proposito del sistema, stack tecnologico y modulos principales.

2. `02-instalacion-local.md`
   - Pasos para instalar dependencias, configurar variables, levantar PostgreSQL y ejecutar la app en `localhost:3002`.

3. `03-base-de-datos-prisma.md`
   - Explicacion del modelo de datos, tablas principales, relaciones y reglas.

4. `04-datos-actuales-snapshot.md`
   - Snapshot documentado de usuarios, formularios, empresas, eventos, premios y contadores existentes al momento de crear esta documentacion.

5. `05-operacion-por-pestanas.md`
   - Que almacena y controla cada pestana de la plataforma.

6. `06-flujos-principales.md`
   - Flujo presencial, virtual, afiliacion, carga masiva, premio final y ganadores PDF.

7. `07-despliegue-github-railway.md`
   - Guia para subir a GitHub y desplegar en Railway con PostgreSQL.

8. `08-backup-restauracion-exacta.md`
   - Comandos para crear una copia exacta de la base actual con `pg_dump` y restaurarla.

9. `09-checklist-verificacion.md`
   - Lista de pruebas para confirmar que el proyecto quedo funcionando correctamente.

## Estado actual del proyecto

- Framework: Next.js 16 con App Router.
- Lenguaje: TypeScript.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Puerto local usado: `3002`.
- Autenticacion: cookie firmada propia con expiracion de 12 horas.
- Roles: `ADMIN` y `PROMOTER`.
- Git local: inicializado con commit base.

## Nota importante sobre datos

La documentacion contiene un snapshot funcional, pero una copia exacta de la base de datos, incluyendo IDs, resultados historicos y hashes de contrasena, debe hacerse con `pg_dump`. No se recomienda guardar dumps con datos reales dentro de GitHub.
