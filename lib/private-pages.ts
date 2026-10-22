const privatePrefixes = ["/proyectos", "/afiliacion", "/sorteos", "/dashboard", "/premios", "/historico", "/estado-premio", "/participacion-digital", "/inscripcion-virtual", "/usuarios", "/bitacora", "/reportes", "/ganadores", "/configuracion", "/actualizacion-datos", "/entrega-souvenir", "/cambiar-clave", "/ruleta/presencial"];

export function isPrivatePage(pathname: string) {
  return pathname === "/" || privatePrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
