# Resumen ejecutivo

## Objetivo

Sistema web responsive para sorteos instantaneos de EDECOOP, orientado a jornadas de captacion de socios, afiliaciones presenciales/virtuales, rifas por eventos y generacion de reportes/listados de ganadores.

## Stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Librerias relevantes:
  - `bcryptjs` para hashes de contrasena.
  - `zod` para validaciones.
  - `qrcode` para QR.
  - `xlsx` para plantillas/cargas Excel.
  - `pdf-lib` para PDF de ganadores.
  - `lucide-react` para iconos.

## Roles

### Administrador

Puede acceder a toda la plataforma:

- Dashboard.
- Participacion presencial.
- Eventos.
- Historico.
- Estado de Premio.
- Participacion Virtual.
- Formularios de Afiliacion.
- Bitacora.
- Ganadores.
- Usuarios.
- Reportes.

### Promotora

Acceso limitado:

- Dashboard.
- Participacion presencial.
- Subpestana de afiliacion presencial.
- Historico.

## Modulos principales

- Sorteo presencial con ruleta.
- Sorteo virtual por enlace unico.
- Formularios de afiliacion virtual/presencial.
- Carga masiva de formularios fisicos.
- Eventos por tipo, mes y ano.
- Premios por evento.
- Premio final de afiliacion.
- Historico de premios.
- Estado de entrega de premios.
- Bitacora administrativa.
- Gestion de usuarios.
- Publicacion independiente de ganadores con PDF.

## Reglas clave

- Cada giro genera un registro unico.
- Cada premio otorgado genera un codigo unico.
- Los codigos de premio usan prefijo `EDE` y maximo 5 numeros despues del prefijo.
- Los enlaces virtuales solo se usan una vez.
- El inventario se descuenta automaticamente.
- El historico conserva snapshot del premio aunque luego el premio se edite o elimine.
- Las acciones sensibles quedan en bitacora.
- Los usuarios nuevos usan clave temporal `123456789` y deben cambiarla al primer acceso.
