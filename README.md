# EDECOOP Sorteos

Aplicacion web responsive para sorteos instantaneos, afiliaciones y reportes de ganadores de EDECOOP.

## Inicio rapido

```powershell
npm install
docker compose up -d
npx prisma generate
npx prisma db push
npm run seed
npm run dev -- --port 3002
```

Abrir:

```text
http://localhost:3002
```

## Documentacion para retomar el proyecto

La documentacion completa esta en:

```text
docs/00-INDICE-DEL-PROYECTO.md
```

Ese indice contiene las guias para:

- instalar el proyecto desde cero,
- crear o restaurar PostgreSQL,
- entender el schema Prisma,
- reconstruir datos actuales,
- desplegar en GitHub/Railway,
- validar que todo funcione,
- y restaurar una copia exacta con `pg_dump`.

## Stack

- Next.js 16
- TypeScript
- React
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Variables principales

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edecoop_sorteos?schema=public"
APP_BASE_URL="http://localhost:3002"
AUTH_SECRET="cambia-este-secreto"
```

## Nota sobre copia exacta

Los archivos Markdown documentan el proyecto y el snapshot operativo, pero una copia exacta de la base actual debe hacerse con `pg_dump`. Ver:

```text
docs/08-backup-restauracion-exacta.md
```
