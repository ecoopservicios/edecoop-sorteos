# Instalacion local

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL local o Docker.
- Git.

## Instalar dependencias

```powershell
npm install
```

## Variables de entorno

Crear `.env` basado en `.env.example`.

Ejemplo local recomendado:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edecoop_sorteos?schema=public"
APP_BASE_URL="http://localhost:3002"
AUTH_SECRET="cambia-este-secreto-por-uno-largo-y-seguro"
PRIZE_CONTACT_WHATSAPP="WhatsApp de EDECOOP"
```

Notas:

- `DATABASE_URL` apunta a PostgreSQL.
- `APP_BASE_URL` se usa para generar enlaces publicos, QR y enlaces de ruleta.
- `AUTH_SECRET` firma las cookies de sesion. En produccion debe ser largo y secreto.
- `PRIZE_CONTACT_WHATSAPP` se imprime en la constancia PDF para coordinar la entrega del premio.

## Levantar PostgreSQL local con Docker

El proyecto incluye `docker-compose.yml`.

```powershell
docker compose up -d
```

El `docker-compose.yml` crea:

- Usuario: `postgres`
- Password: `postgres`
- Base: `edecoop_sorteos`
- Puerto: `5432`

## Aplicar schema Prisma

```powershell
npx prisma generate
npx prisma db push
```

## Cargar datos base

```powershell
npm run seed
```

El seed original crea:

- Admin demo: `admin@edecoop.local`
- Promotora demo: `promotora@edecoop.local`
- Premios demo antiguos.
- Contador presencial.

Para reconstruir el estado exacto actual, ver:

- `04-datos-actuales-snapshot.md`
- `08-backup-restauracion-exacta.md`

## Ejecutar en puerto 3002

```powershell
npm run dev -- --port 3002
```

Abrir:

```text
http://localhost:3002
```

## Validar TypeScript

```powershell
npx tsc --noEmit
```

## Build de produccion local

```powershell
npm run build
npm run start
```

Si necesitas forzar puerto:

```powershell
npx next start -p 3002
```
