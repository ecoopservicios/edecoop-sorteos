export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

export function buildWhatsappUrl(phone: string, link: string) {
  const normalizedPhone = normalizePhone(phone);
  const message = `Hola, EDECOOP te invita a participar en nuestro sorteo instantáneo. Ingresa aquí para girar la ruleta una sola vez: ${link}`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
