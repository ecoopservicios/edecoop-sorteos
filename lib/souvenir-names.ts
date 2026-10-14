export function souvenirNameKey(value: string) {
  // Preserve Ñ as its own letter while ignoring accent and typography variants.
  return Array.from(value.normalize("NFC").toLocaleUpperCase("es"))
    .map(letter => letter === "Ñ" ? letter : letter.normalize("NFD").replace(/\p{M}/gu, ""))
    .join("").replace(/[’‘ʼ]/g, "'").replace(/\p{Pd}/gu, "-")
    .trim().replace(/\s+/g, " ");
}
