export const SOUVENIR_HEADERS = [
  "NOMBRES", "APELLIDOS", "CEDULA CONSULTA", "CEDULA MOSTRAR",
  "NO EMPLEADO", "EMPRESA", "SEXO", "OFICINA", "UNIDAD", "UBICACION APROXIMADA"
];

export function normalizeSouvenirHeader(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[\s_]+/g, "_");
}
