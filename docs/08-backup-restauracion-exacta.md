# Backup y restauracion exacta

Para que otro entorno quede igual al actual, con los mismos IDs, usuarios, hashes, eventos, premios, resultados, reportes y contadores, se necesita un dump de PostgreSQL.

La documentacion Markdown no debe contener secretos ni hashes de usuarios. Por eso el metodo correcto es `pg_dump`.

## Crear backup exacto local

Si la base corre en PostgreSQL local:

```powershell
pg_dump "postgresql://postgres:postgres@localhost:5432/edecoop_sorteos?schema=public" --format=custom --file "edecoop_sorteos.backup"
```

Si usa Docker:

```powershell
docker exec edecoop_sorteos_postgres pg_dump -U postgres -d edecoop_sorteos -Fc > edecoop_sorteos.backup
```

## Crear backup SQL plano

```powershell
pg_dump "postgresql://postgres:postgres@localhost:5432/edecoop_sorteos?schema=public" --file "edecoop_sorteos.sql"
```

## Restaurar backup custom

Crear base vacia:

```powershell
createdb "postgresql://postgres:postgres@localhost:5432/edecoop_sorteos"
```

Restaurar:

```powershell
pg_restore --clean --if-exists --no-owner --dbname "postgresql://postgres:postgres@localhost:5432/edecoop_sorteos" "edecoop_sorteos.backup"
```

## Restaurar SQL plano

```powershell
psql "postgresql://postgres:postgres@localhost:5432/edecoop_sorteos" -f "edecoop_sorteos.sql"
```

## Restaurar en Railway

1. Crear PostgreSQL en Railway.
2. Copiar `DATABASE_URL`.
3. Ejecutar:

```powershell
pg_restore --clean --if-exists --no-owner --dbname "DATABASE_URL_DE_RAILWAY" "edecoop_sorteos.backup"
```

O con SQL:

```powershell
psql "DATABASE_URL_DE_RAILWAY" -f "edecoop_sorteos.sql"
```

## Despues de restaurar

Ejecutar:

```powershell
npx prisma generate
npx tsc --noEmit
npm run dev -- --port 3002
```

## Recomendacion de seguridad

No subir `edecoop_sorteos.backup` ni `edecoop_sorteos.sql` a GitHub si contienen datos reales.

Guardar el backup en:

- almacenamiento seguro,
- unidad externa,
- Google Drive/OneDrive privado,
- o gestor documental autorizado.
