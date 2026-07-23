# Despliegue GitHub y Railway

## GitHub

El proyecto ya esta inicializado como repo Git local.

Para conectar a un repo nuevo:

```powershell
git remote add origin https://github.com/USUARIO/REPO.git
git branch -M main
git push -u origin main
```

Si ya existe `origin`:

```powershell
git remote set-url origin https://github.com/USUARIO/REPO.git
git push -u origin main
```

## Archivos que no deben subirse

Ya estan en `.gitignore`:

- `.env`
- `node_modules`
- `.next`
- `outputs`
- `work`
- `public/uploads`
- dumps de bases de datos locales.

No subir:

- Tokens de Railway.
- URL de base de datos productiva.
- Contraseñas.
- Dumps con datos reales.

## Railway

### Variables requeridas

```env
DATABASE_URL="postgresql://..."
APP_BASE_URL="https://TU-DOMINIO.up.railway.app"
AUTH_SECRET="secreto-largo-y-seguro"
```

### Build command

```bash
npm run build
```

### Start command

```bash
npm run start
```

Si Railway requiere puerto explicitamente:

```bash
npx next start -p $PORT
```

## Usar dos cuentas de Railway

Railway CLI maneja una sesion global, pero se pueden usar tokens por terminal.

Terminal cuenta A:

```powershell
$env:RAILWAY_TOKEN="TOKEN_CUENTA_A"
railway whoami
```

Terminal cuenta B:

```powershell
$env:RAILWAY_TOKEN="TOKEN_CUENTA_B"
railway whoami
```

No guardar tokens en Git.

## Crear proyecto Railway desde CLI

Con token de la cuenta correcta:

```powershell
$env:RAILWAY_TOKEN="TOKEN_CUENTA_CORRECTA"
railway init
```

Agregar PostgreSQL desde Railway dashboard o CLI.

Luego:

```powershell
railway up
```

## Despues del despliegue

Ejecutar en entorno Railway:

```bash
npx prisma db push
npm run seed
```

Si se quiere restaurar copia exacta:

- Crear PostgreSQL en Railway.
- Restaurar dump usando `psql`.
- No ejecutar seed si el dump ya contiene datos.
