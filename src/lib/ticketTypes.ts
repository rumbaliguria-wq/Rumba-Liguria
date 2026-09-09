export interface TicketType {
  name: string;
  color: string;
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