// Encode/decode sale_start, sale_end, archive_at y promo_2x1 into the details field
// Format: actual details text + "|||SALE:{...}"
const SALE_MARKER = "|||SALE:";

export function encodeSaleConfig(
  details: string,
  sale_start?: string | null,
  sale_end?: string | null,
  archive_at?: string | null,
  promo_2x1?: boolean | null,
): string {
  // Strip any existing sale config
  const cleanDetails = stripSaleConfig(details);
  if (!sale_start && !sale_end && !archive_at && !promo_2x1) return cleanDetails;
  const config = JSON.stringify({
    sale_start: sale_start || null,
    sale_end: sale_end || null,
    archive_at: archive_at || null,
    promo_2x1: !!promo_2x1,
  });
  return cleanDetails + SALE_MARKER + config;
}

export function decodeSaleConfig(details: string): {
  details: string;
  sale_start: string | null;
  sale_end: string | null;
  archive_at: string | null;
  promo_2x1: boolean;
} {
  if (!details) return { details: "", sale_start: null, sale_end: null, archive_at: null, promo_2x1: false };
  const idx = details.indexOf(SALE_MARKER);
  if (idx === -1) return { details, sale_start: null, sale_end: null, archive_at: null, promo_2x1: false };
  const cleanDetails = details.slice(0, idx);
  try {
    const config = JSON.parse(details.slice(idx + SALE_MARKER.length));
    return {
      details: cleanDetails,
      sale_start: config.sale_start || null,
      sale_end: config.sale_end || null,
      archive_at: config.archive_at || null,
      promo_2x1: !!config.promo_2x1,
    };
  } catch {
    return { details: cleanDetails, sale_start: null, sale_end: null, archive_at: null, promo_2x1: false };
  }
}

export function stripSaleConfig(details: string): string {
  if (!details) return "";
  const idx = details.indexOf(SALE_MARKER);
  return idx === -1 ? details : details.slice(0, idx);
}
