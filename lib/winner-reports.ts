import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const WINNER_TEMPLATE_HEADERS = ["Ref", "ID", "Nombre", "Premio RD", "Localidad"] as const;

export type ParsedWinnerRow = {
  ref: number;
  winnerId: string;
  name: string;
  prize: string;
  location: string;
};

export function formatWinnerPrize(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const currencyPrefix = raw.toUpperCase().includes("RD") ? "RD$ " : "";
  const clean = raw.replace(/RD\$?/gi, "").replace(/\$/g, "").replace(/,/g, "").trim();
  const number = Number(clean);

  if (!Number.isFinite(number)) return raw;

  const hasDecimals = Math.round(number) !== number;
  return `${currencyPrefix}${number.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0
  })}`;
}

export function normalizeWinnerHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "_");
}

export function parseWinnerRows(rows: Record<string, unknown>[]) {
  const errors: Array<{ row: number; message: string }> = [];
  const parsed: ParsedWinnerRow[] = [];
  const seenIds = new Map<string, number>();
  const seenRefs = new Map<number, number>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeWinnerHeader(key), String(value || "").trim()])
    );

    const refValue = normalized.ref || String(index + 1);
    const ref = Number.parseInt(refValue, 10);
    const winnerId = normalized.id || "";
    const name = normalized.nombre || "";
    const prize = normalized.premio_rd || normalized.premio || "";
    const location = normalized.localidad || "";
    const rowErrors: string[] = [];

    if (!Number.isFinite(ref) || ref <= 0) rowErrors.push("Ref debe ser un numero mayor que cero.");
    if (!winnerId) rowErrors.push("ID es requerido.");
    if (!name) rowErrors.push("Nombre es requerido.");
    if (!prize) rowErrors.push("Premio RD es requerido.");
    if (!location) rowErrors.push("Localidad es requerida.");

    if (winnerId) {
      const previous = seenIds.get(winnerId);
      if (previous) rowErrors.push(`ID repetido en el archivo. Tambien aparece en la fila ${previous}.`);
      seenIds.set(winnerId, rowNumber);
    }

    if (Number.isFinite(ref) && ref > 0) {
      const previous = seenRefs.get(ref);
      if (previous) rowErrors.push(`Ref repetido en el archivo. Tambien aparece en la fila ${previous}.`);
      seenRefs.set(ref, rowNumber);
    }

    if (rowErrors.length) {
      errors.push({ row: rowNumber, message: `${name || "GANADOR SIN NOMBRE"}: ${rowErrors.join(" ")}` });
      return;
    }

    parsed.push({
      ref,
      winnerId,
      name: name.toUpperCase(),
      prize: formatWinnerPrize(prize),
      location: location.toUpperCase()
    });
  });

  return { rows: parsed.sort((a, b) => a.ref - b.ref), errors };
}

export function publicUploadPath(relativePath: string) {
  return relativePath.startsWith("/") ? relativePath : `/${relativePath.replace(/\\/g, "/")}`;
}

export async function saveWinnerImage(file: File, reportId: string, kind: "header" | "footer") {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo debe ser una imagen.");
  }

  const extension = path.extname(file.name).toLowerCase() || ".png";
  const fileName = `${kind}-${randomUUID()}${extension}`;
  const relativeDir = path.join("uploads", "ganadores", reportId);
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await fs.mkdir(absoluteDir, { recursive: true });
  const absolutePath = path.join(absoluteDir, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, bytes);
  return publicUploadPath(path.join(relativeDir, fileName));
}

export function absolutePublicFile(publicPath?: string | null) {
  if (!publicPath) return null;
  const clean = publicPath.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", clean);
}
