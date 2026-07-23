# Checklist de verificacion

Usar esta lista despues de instalar, restaurar o desplegar.

## Instalacion

- [ ] `npm install` completo sin errores.
- [ ] `.env` creado.
- [ ] `DATABASE_URL` apunta a PostgreSQL correcto.
- [ ] `APP_BASE_URL` apunta al dominio o localhost correcto.
- [ ] `AUTH_SECRET` configurado.
- [ ] `npx prisma generate` ejecutado.
- [ ] `npx prisma db push` ejecutado si no se restauro dump.
- [ ] `npm run seed` ejecutado solo si no se restauro dump completo.

## Validacion tecnica

- [ ] `npx tsc --noEmit` pasa sin errores.
- [ ] `npm run build` pasa sin errores.
- [ ] App abre en `http://localhost:3002`.
- [ ] Login carga sin error.
- [ ] Al refrescar navegador, vuelve al login si corresponde.

## Login y usuarios

- [ ] Admin puede iniciar sesion.
- [ ] Promotora puede iniciar sesion.
- [ ] Usuario con `mustChangePassword` va a cambio de clave.
- [ ] Reset de clave deja clave temporal `123456789`.
- [ ] Chrome/navegador reconoce formulario de login para guardar contrasena.

## Eventos

- [ ] Existen tipos de evento.
- [ ] Existe evento Afiliacion Premio Instantaneo Julio 2026.
- [ ] Existe evento Afiliacion Premio Final Julio 2026.
- [ ] Premios aparecen bajo el evento correcto.
- [ ] Inactivar evento inactiva premios asociados.

## Sorteo presencial

- [ ] La pagina muestra selector de evento.
- [ ] La ruleta carga premios del evento seleccionado.
- [ ] Al girar, genera codigo unico.
- [ ] Descuenta inventario.
- [ ] Permite marcar entregado o pendiente.
- [ ] Limpia resultado visual despues de 1 minuto.

## Participacion virtual

- [ ] Participantes disponibles aparecen.
- [ ] WhatsApp se bloquea si el link esta usado.
- [ ] Link usado no permite repetir giro.
- [ ] Edicion/eliminacion bloqueadas segun reglas.

## Formularios de afiliacion

- [ ] Link publico abre sin login.
- [ ] QR genera correctamente.
- [ ] Formulario valida campos obligatorios.
- [ ] Cedula solo acepta 11 numeros.
- [ ] NIE/numero de empleado maximo 5 numeros.
- [ ] Telefonos solo aceptan 10 numeros.
- [ ] Duplicados por cedula, NIE, correo y telefono se bloquean.
- [ ] Canal se guarda como `VIRTUAL`, `PRESENTIAL_DIGITAL` o `PRESENTIAL_FISICO`.

## Historico y estado de premio

- [ ] Historico muestra premios otorgados.
- [ ] Estado de Premio muestra pendientes/enviados.
- [ ] Al marcar entregado, desaparece de Estado de Premio.
- [ ] Historico conserva evento, premio, participante y codigo.

## Ganadores PDF

- [ ] Se puede crear reporte.
- [ ] Se pueden subir imagenes.
- [ ] Plantilla Excel descarga sin pedir autorizacion incorrecta.
- [ ] Carga Excel reemplaza tabla anterior.
- [ ] PDF genera sin error 500.
- [ ] PDF muestra cabecera solo en primera pagina.
- [ ] Tabla tiene encabezados.
- [ ] Referencia imprime del 1 al total.
- [ ] Orden por localidad.
- [ ] Premio RD$ usa coma de miles.

## Responsive

- [ ] En escritorio el menu esta arriba.
- [ ] En movil el menu es hamburguesa.
- [ ] El menu movil abre sobre la pagina y no desplaza contenido.
- [ ] Tablas tienen scroll interno.
- [ ] Iconos de acciones se adaptan en pantallas pequenas.
