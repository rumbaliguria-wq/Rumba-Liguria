// Sesión del panel de administración.
//
// El navegador guarda un token firmado con HMAC-SHA256 en una cookie httpOnly
// (no accesible desde JS). Tanto el middleware (runtime edge) como los route
// handlers (Node) lo verifican con Web Crypto, disponible en ambos entornos.
//
// El token NO lleva datos sensibles: sólo { sub: "admin", iat, exp }. Si la
// firma no cuadra o ha caducado, no hay sesión.

export const ADMIN_COOKIE = "rl_admin_session";
export const ADMIN_SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 giorni, in secondi

// Cookie separata y de más larga duración: marca que este navegador ya pasó
// el 2FA una vez, para no volver a pedir el código de email/WhatsApp en los
// próximos logins desde el mismo dispositivo (solo usuario + contraseña).
export const ADMIN_TRUSTED_COOKIE = "rl_admin_trusted";
export const ADMIN_TRUSTED_MAX_AGE = 24 * 60 * 60; // 24 ore, in secondi

function getSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_PASSWORD ||
    "rumba-liguria-insecure-dev-secret"
  );
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sign(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function createToken(sub: string, maxAge: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, iat: now, exp: now + maxAge };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = b64urlEncode(await sign(body));
  return `${body}.${sig}`;
}

async function verifyToken(token: string | undefined | null, expectedSub: string): Promise<boolean> {
  if (!token || !token.includes(".")) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  try {
    const expected = await sign(body);
    if (!timingSafeEqual(b64urlDecode(sig), expected)) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as {
      sub?: string;
      exp?: number;
    };
    if (payload.sub !== expectedSub) return false;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function createSessionToken(): Promise<string> {
  return createToken("admin", ADMIN_SESSION_MAX_AGE);
}

export function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  return verifyToken(token, "admin");
}

export function createTrustedDeviceToken(): Promise<string> {
  return createToken("admin_trusted_device", ADMIN_TRUSTED_MAX_AGE);
}

export function verifyTrustedDeviceToken(token: string | undefined | null): Promise<boolean> {
  return verifyToken(token, "admin_trusted_device");
}

export function sessionCookieOptions(maxAge: number = ADMIN_SESSION_MAX_AGE) {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function trustedDeviceCookieOptions() {
  return {
    name: ADMIN_TRUSTED_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TRUSTED_MAX_AGE,
  };
}
