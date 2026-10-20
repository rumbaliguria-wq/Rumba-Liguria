export interface TicketType {
  name: string;
  color: string;
  price?: number;
  description?: string;
  // Cupo propio de este tipo (aparte del cupo general del evento). null/undefined = sin límite.
  quantity?: number | null;
  // Ventana de venta propia de este tipo (aparte de la del evento general).
  sale_start?: string | null;
  sale_end?: string | null;
  // Solo para que el form de admin recuerde mostrar el precio como "neto +
  // comisión" al editar — el precio ya cobrado (bruto) sigue siendo `price`,
  // así que nada más en la app necesita saber de esto.
  feesToBuyer?: boolean;
  // Se muestra en el Carrello (con casilla obligatoria para aceptar) y, si
  // está, también se manda a Stripe como el texto del checkbox de términos
  // en la propia página de pago, y un pedacito queda al pie de la factura.
  terms?: string;
}

const TT_MARKER = "|||TTYPES:";

export function encodeTicketTypes(details: string, types: TicketType[]): string {
  // Strip existing ticket types
  const clean = stripTicketTypes(details);
  if (!types || types.length === 0) return clean;
  return clean + TT_MARKER + JSON.stringify(types);
}

// El orden real guardado en details es "...|||TTYPES:[...]|||SALE:{...}" (el
// marcador de SALE se agrega DESPUÉS del de TTYPES). La mayoría de quien
// llama a esto primero saca el SALE con decodeSaleConfig y recién después
// decodifica esto — pero no todos lo hacían así, y si no se saca antes el
// JSON.parse se rompía en silencio (try/catch) y el evento quedaba SIN
// tipos de biglietto, osea que se cobraba como gratis. Para no depender de
// que cada lugar llame en el orden correcto, acá mismo se recorta el
// "|||SALE:" si todavía viene pegado.
export function decodeTicketTypes(details: string): { details: string; types: TicketType[] } {
  if (!details) return { details: "", types: [] };
  const idx = details.indexOf(TT_MARKER);
  if (idx === -1) return { details, types: [] };
  const cleanDetails = details.slice(0, idx);
  let jsonPart = details.slice(idx + TT_MARKER.length);
  const saleIdx = jsonPart.indexOf("|||SALE:");
  if (saleIdx !== -1) jsonPart = jsonPart.slice(0, saleIdx);
  try {
    const types = JSON.parse(jsonPart);
    return { details: cleanDetails, types: Array.isArray(types) ? types : [] };
  } catch {
    return { details: cleanDetails, types: [] };
  }
}

export function stripTicketTypes(details: string): string {
  if (!details) return "";
  const idx = details.indexOf(TT_MARKER);
  return idx === -1 ? details : details.slice(0, idx);
}

export function stripAllMarkers(details: string): string {
  return stripTicketTypes(stripTicketTypes(details)); // Actually only need one pass for each marker
}

// El nombre del tipo de biglietto elegido al comprar se guarda metido en
// user_name ("... [tipo:VIP]") porque reservations no tiene su propia
// columna para esto — ver createReservationsAndNotify. Este helper lo
// vuelve a sacar para poder contar cuántos de cada tipo ya se vendieron.
export function extractTicketTypeTag(userName: string | null | undefined): string | null {
  if (!userName) return null;
  const m = userName.match(/\[tipo:([^\]]+)\]/);
  return m ? m[1] : null;
}

// Un color demasiado claro (pastel, amarillo pálido, etc.) hace que el QR no
// se pueda escanear de verdad con la cámara del celular en la puerta — lo
// confirmamos decodificando PNGs reales con jsQR: a partir de más o menos
// luminancia 0,8 empieza a fallar incluso en condiciones ideales, y en la
// puerta (luz de discoteca, cámara en movimiento) es bastante menos
// tolerante. Este límite deja margen de sobra.
const MAX_QR_LUMINANCE = 0.7;

export function isQrSafeColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance <= MAX_QR_LUMINANCE;
}
