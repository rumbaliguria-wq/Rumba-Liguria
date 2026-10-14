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
}

const TT_MARKER = "|||TTYPES:";

export function encodeTicketTypes(details: string, types: TicketType[]): string {
  // Strip existing ticket types
  const clean = stripTicketTypes(details);
  if (!types || types.length === 0) return clean;
  return clean + TT_MARKER + JSON.stringify(types);
}

export function decodeTicketTypes(details: string): { details: string; types: TicketType[] } {
  if (!details) return { details: "", types: [] };
  const idx = details.indexOf(TT_MARKER);
  if (idx === -1) return { details, types: [] };
  const cleanDetails = details.slice(0, idx);
  try {
    const types = JSON.parse(details.slice(idx + TT_MARKER.length));
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
