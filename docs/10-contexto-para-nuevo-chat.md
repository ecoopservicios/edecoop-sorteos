# Contexto para nuevo chat o nuevo desarrollador

Este archivo es el punto de entrada recomendado para continuar el proyecto en otro chat.

## Proyecto

Sistema EDECOOP Sorteos.

Ruta local actual:

```text
C:\Users\Jeper\Documents\Codex\2026-07-07\quiero-desarrollar-un-software-web-responsive
```

Puerto local:

```text
http://localhost:3002
```

## Estado funcional actual

La app funciona como plataforma web responsive con:

- Login por rol.
- Menu superior en escritorio.
- Menu hamburguesa flotante en movil.
- Dashboard por evento.
- Participacion presencial.
- Participacion virtual.
- Formularios de afiliacion.
- Eventos.
- Premios por evento.
- Historico.
- Estado de Premio.
- Bitacora.
- Usuarios.
- Ganadores con carga Excel y PDF.

## Stack

- Next.js 16.
- TypeScript.
- Tailwind CSS.
- Prisma.
- PostgreSQL.

## Base de datos

Schema:

```text
prisma/schema.prisma
```

Variables:

```env
DATABASE_URL="postgresql://..."
APP_BASE_URL="http://localhost:3002"
AUTH_SECRET="..."
```

Para clonar exactamente los datos actuales:

1. Crear PostgreSQL vacio.
2. Ejecutar `npx prisma generate`.
3. Ejecutar `npx prisma db push`.
4. Restaurar exportacion exacta desde:

```text
base-de-datos/restore-edecoop-data.js
```

La exportacion exacta esta en:

```text
base-de-datos/edecoop-data-export.json
```

## Usuarios actuales documentados

- `admin@edecoop.local`
- `promotora@edecoop.local`
- `richard.segura@edesur.com.do`
- `jepereza@edesur.com.do`

Las claves reales no estan documentadas en texto plano. Los hashes se conservan solo si se restaura la exportacion exacta o un dump.

Usuarios nuevos usan clave temporal:

```text
123456789
```

## Eventos actuales

- Afiliacion Premio Instantaneo Julio 2026.
- Afiliacion Premio Final Julio 2026.

Premios actuales principales:

- Sombrilla.
- Nevera Playera Pequena.
- Laptop.

## Formulario actual

Formulario unico de afiliacion:

```text
Solicitud de Admision EDECOOP
```

Canales de afiliacion:

- `VIRTUAL`
- `PRESENTIAL_DIGITAL`
- `PRESENTIAL_FISICO`

## Reglas criticas que no deben romperse

- No entregar premios sin registrar historico.
- No reutilizar enlaces virtuales usados.
- No permitir duplicados de cedula, NIE, correo o telefono en afiliaciones.
- No atar el historico a premios editables/eliminables.
- Los premios entregados deben conservar snapshot.
- Estado de Premio solo muestra pendientes/enviados; entregados van a Historico.
- La promotora no debe acceder a modulos administrativos.
- El formulario publico debe abrir sin login.
- La ruleta final debe seleccionar ganador aleatoriamente.

## Documentos clave

Leer en este orden:

1. `docs/00-INDICE-DEL-PROYECTO.md`
2. `docs/01-resumen-ejecutivo.md`
3. `docs/02-instalacion-local.md`
4. `docs/03-base-de-datos-prisma.md`
5. `docs/04-datos-actuales-snapshot.md`
6. `docs/08-backup-restauracion-exacta.md`
7. `docs/09-checklist-verificacion.md`

## Como levantar

```powershell
npm install
npx prisma generate
npx prisma db push
npm run dev -- --port 3002
```

## Como verificar

```powershell
npx tsc --noEmit
```

Luego abrir:

```text
http://localhost:3002/login
```

## Nota de seguridad

No subir a GitHub:

- `.env`
- `_secrets_no_subir`
- `edecoop-data-export.json` si contiene datos reales.
- dumps `.backup` o `.sql`.
- `public/uploads` si contiene imagenes o documentos sensibles.

## Ultima recomendacion para el nuevo chat

Antes de cambiar codigo, leer el schema Prisma y revisar los componentes principales:

- `components/app-shell-client.tsx`
- `components/events-manager.tsx`
- `components/presential-wheel.tsx`
- `components/digital-links-table.tsx`
- `components/enrollment-public-form.tsx`
- `components/enrollment-submissions-table.tsx`
- `components/winners-manager.tsx`
