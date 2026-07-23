import { NextResponse } from "next/server";

import { canSpinPresential, getCurrentUser } from "@/lib/auth";

import { jsonError } from "@/lib/api";



export async function GET() {

  const user = await getCurrentUser();

  if (!canSpinPresential(user)) return jsonError("No autorizado.", 403);



  const csv = [

    "nombres,apellidos,cedula,numero_flota,celular,ciudad,direccion,estado_civil,nombre_conyuge,empresa,cargo,dependencia,oficina,correo_electronico,sueldo_mensual,nie,cta_banco_no,nombre_banco,porcentaje_descuento,codigo_premio",

    "JUAN, PEREZ,00112345678,8091234567,8095551234,SANTO DOMINGO,CALLE 1,SOLTERO,,EDESUR,ANALISTA,COMERCIAL,OFICINA CENTRAL,juan@email.com,50000,12345,,,4,"

  ].join("\r\n");



  return new NextResponse(csv, {

    headers: {

      "Content-Type": "text/csv; charset=utf-8",

      "Content-Disposition": 'attachment; filename="plantilla-afiliacion-presencial.csv"'

    }

  });

}

