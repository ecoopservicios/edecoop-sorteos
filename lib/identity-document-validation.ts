const NAME_CONNECTORS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y"]);

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function similarToken(expected: string, actual: string) {
  if (expected === actual) return true;
  if (expected.length < 4 || actual.length < 4) return false;
  return 1 - editDistance(expected, actual) / Math.max(expected.length, actual.length) >= 0.76;
}

function nameTokens(value: string) {
  return normalized(value).split(" ").filter(token => token.length > 1 && !NAME_CONNECTORS.has(token));
}

function nameMatch(firstName: string, lastName: string, text: string) {
  const first = nameTokens(firstName);
  const last = nameTokens(lastName);
  if (!first.length || !last.length) return false;
  const expected = [...first, ...last];
  const actual = normalized(text).split(" ").filter(token => /[A-Z]/.test(token))
    .map(token => token.replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S"));
  const matches = (token: string) => actual.some(candidate => similarToken(token, candidate));
  const required = expected.length <= 2 ? expected.length : Math.max(2, Math.ceil(expected.length * 0.6));
  return first.some(matches) && last.some(matches) && expected.filter(matches).length >= required;
}

function numericText(value: string) {
  return value.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/\D/g, "");
}

function numberMatch(expected: string, lines: string[]) {
  if (!expected) return false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const groups: string[] = line.match(/\d+/g) ?? [];
    if (groups.includes(expected) || groups.join("") === expected) return true;
    const runs = line.toUpperCase().match(/[0-9OILSB]+(?:[ .-]+[0-9OILSB]+)*/g) ?? [];
    if (runs.some(run => /\d/.test(run) && numericText(run) === expected)) return true;
    // OCR may split a printed number over adjacent boxes. Never guess a missing digit.
    let joined = "";
    for (let offset = 0; offset < 3 && index + offset < lines.length; offset++) {
      const part = lines[index + offset].trim();
      if (!/^[0-9OILSB .-]+$/i.test(part) || !/\d/.test(part)) break;
      joined += numericText(part);
      if (joined === expected) return true;
      if (joined.length >= expected.length) break;
    }
  }
  return false;
}

function hasTokens(text: string, expected: string[]) {
  const normalizedText = normalized(text);
  const tokens = normalizedText.split(" ").filter(Boolean);
  return new RegExp(expected.join("(?:DE|DEL|LA|LAS|LOS|Y)*")).test(normalizedText.replace(/ /g, ""))
    || expected.every(item => tokens.some(token => similarToken(item, token)));
}

export function checkIdentityDocument(member: {
  companyName: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  employeeNumber: string | null;
}, kind: "EMPLOYEE_CARD" | "DOCUMENT_ID", lines: string[]) {
  const company = normalized(member.companyName).replace(/ /g, "");
  const expected = (kind === "EMPLOYEE_CARD" ? member.employeeNumber : member.documentId)?.replace(/\D/g, "") || "";
  if (!expected || (kind === "EMPLOYEE_CARD" && !["EDESUR", "EDECOOP"].includes(company))) return "TYPE";
  const text = lines.join(" ");
  const formatMatches = kind === "DOCUMENT_ID"
    ? [["REPUBLICA", "DOMINICANA"], ["JUNTA", "CENTRAL", "ELECTORAL"], ["CEDULA", "IDENTIDAD"]].filter(marker => hasTokens(text, marker)).length >= 2
    : hasTokens(text, [company]);
  if (!formatMatches) return "FORMAT";
  if (!numberMatch(expected, lines)) return "NUMBER";
  if (!nameMatch(member.firstName, member.lastName, text)) return "NAME";
  return null;
}
