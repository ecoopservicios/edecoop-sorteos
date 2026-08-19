param(
  [switch]$OpenDashboard,
  [switch]$Deploy
)

$ErrorActionPreference = "Stop"

$ProjectId = "2a6e9f58-f1da-4fdd-b298-c2ae8982a931"
$ProjectName = "lively-reprieve"
$ServiceName = "edecoop-sorteos"
$EnvironmentName = "production"
$AppUrl = "https://edecoop-sorteos-production.up.railway.app"
$ExpectedAccount = "ecoop.servicios@gmail.com"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

try {
  $Railway = (Get-Command railway.cmd -ErrorAction Stop).Source
} catch {
  Write-Host "No encontre railway.cmd. Instala Railway CLI o revisa el PATH." -ForegroundColor Red
  Read-Host "Presiona Enter para cerrar"
  exit 1
}

Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "EDECOOP - Cambiar rapido a Railway" -ForegroundColor Green
Write-Host "Proyecto: $ProjectName"
Write-Host "Servicio: $ServiceName"
Write-Host "Ambiente: $EnvironmentName"

Write-Step "Verificando sesion de Railway"
$whoami = (& $Railway whoami 2>$null) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $whoami) {
  Write-Host "No hay sesion activa. Se abrira el login de Railway." -ForegroundColor Yellow
  & $Railway login
} elseif ($whoami -notmatch [regex]::Escape($ExpectedAccount)) {
  Write-Host "La sesion actual de Railway no parece ser $ExpectedAccount." -ForegroundColor Yellow
  Write-Host "Sesion detectada:"
  Write-Host $whoami
  Write-Host ""
  Write-Host "Esto solo cambia la sesion de Railway CLI en esta PC; no cierra tu GitHub ni tus apps web." -ForegroundColor DarkGray
  $answer = Read-Host "Escribe SI para cerrar esta sesion CLI e iniciar Railway con EDECOOP"
  if ($answer -ne "SI") {
    Write-Host "Operacion cancelada. No se cambio la sesion de Railway." -ForegroundColor Yellow
    Read-Host "Presiona Enter para cerrar"
    exit 0
  }

  & $Railway logout
  & $Railway login
}

Write-Step "Enlazando esta carpeta al Railway de EDECOOP"
& $Railway link --project $ProjectId --service $ServiceName --environment $EnvironmentName

Write-Step "Estado actual"
& $Railway status

if ($Deploy) {
  Write-Step "Subiendo despliegue a Railway"
  & $Railway up --detach
}

if ($OpenDashboard) {
  Write-Step "Abriendo dashboard de Railway"
  & $Railway open
}

Write-Host ""
Write-Host "Listo. App publica: $AppUrl" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
