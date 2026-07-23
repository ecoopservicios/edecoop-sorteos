# EDECOOP Sorteos

Aplicacion web responsive para sorteos instantaneos presenciales y digitales de EDECOOP.

## Stack

- Next.js 16
- TypeScript
- React
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Configuracion local

1. Instalar dependencias:

```bash
npm install
```

2. Configurar `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edecoop_sorteos?schema=public"
APP_BASE_URL="http://localhost:3000"
AUTH_SECRET="cambia-este-secreto"
```

3. Levantar PostgreSQL con Docker:

```bash
docker compose up -d
```

4. Aplicar schema y datos demo:

```bash
npx prisma db push
npm run seed
```

5. Ejecutar la app:

```bash
npm run dev
```

## Usuarios demo

- Admin: `admin@edecoop.local` / `admin123`
- Promotora: `promotora@edecoop.local` / `promo123`

## Modulos incluidos

- Login por rol.
- Dashboard administrativo.
- Ruleta presencial para administradores y promotoras.
- Ruleta digital publica por token de un solo uso.
- Administracion de premios e inventario.
- Historico de premios otorgados.
- Participacion digital con enlace unico y WhatsApp prellenado.
- Usuarios administradores y promotoras.
- Reporte inicial por premio.

## Notas

- El resultado del sorteo se decide siempre en backend.
- Cada giro descuenta inventario dentro de una transaccion.
- Cada premio otorgado genera un codigo unico.
- En digital, el enlace queda marcado como usado dentro de la misma transaccion.
- En presencial, el participante se genera como `Participante 000001`, `Participante 000002`, etc.
