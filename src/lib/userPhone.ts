/**
 * Since we can't add a 'name' column without DB migrations,
 * we store { n: fullName, p: phone, t: userType } as JSON in the phone field.
 * Existing users with plain phone strings or null are handled gracefully.
 *
 * userType: "ERASMUS" | "UNIVERSITARIO" | "ALTRO"
 */

export function encodePhoneField(name: string, phone: string, userType?: string): string {
  const obj: Record<string, string> = { n: name.trim(), p: phone.trim() };
  if (userType) obj.t = userType.trim();
  return JSON.stringify(obj);
}

/**
 * Strict phone validation + normalization to E.164.
 * - Accepts "+<country><number>", "00<country><number>", or a bare Italian
 *   mobile (3xxxxxxxxx) which gets +39 prepended.
 * - Rejects numbers without a country prefix and obviously fake patterns
 *   (8+ repeated digits, long ascending sequences).
 */
export function normalizePhone(raw: string):
  | { ok: true; e164: string }
  | { ok: false; error: string } {
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // Italian mobile typed without prefix (3xx xxx xxxx)
  if (/^3\d{8,9}$/.test(s)) s = "+39" + s;
  if (!s.startsWith("+")) {
    return { ok: false, error: "Inserisci il numero con il prefisso internazionale (es. +39 347 000 0000)" };
  }
  if (!/^\+[1-9]\d{7,14}$/.test(s)) {
    return { ok: false, error: "Numero di telefono non valido (es. +39 347 000 0000)" };
  }
  const digits = s.slice(1);
  if (/(\d)\1{7,}/.test(digits) || /(?:1234567|2345678|3456789|9876543|8765432)/.test(digits)) {
    return { ok: false, error: "Inserisci un numero di telefono reale" };
  }
  return { ok: true, e164: s };
}

export function decodePhoneField(raw: string | null): {
  name: string | null;
  phone: string | null;
  userType: string | null;
} {
  if (!raw) return { name: null, phone: null, userType: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "n" in parsed) {
      return {
        name: parsed.n || null,
        phone: parsed.p || null,
        userType: parsed.t || null,
      };
    }
  } catch {
    // Plain string — old-style phone number, no name
  }
  return { name: null, phone: raw, userType: null };
}