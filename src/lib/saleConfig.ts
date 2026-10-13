// Encode/decode sale_start, sale_end, archive_at y la promo (cada X entradas,
// Y gratis) into the details field
// Format: actual details text + "|||SALE:{...}"
const SALE_MARKER = "|||SALE:";

export function encodeSaleConfig(
  details: string,
  sale_start?: string | null,
  sale_end?: string | null,
  archive_at?: string | null,
  promo_group?: number | null,
  promo_free?: number | null,
  unlisted?: boolean | null,
): string {
  // Strip any existing sale config
  const cleanDetails = stripSaleConfig(details);
  if (!sale_start && !sale_end && !archive_at && !promo_group && !promo_free && !unlisted) return cleanDetails;
  const config = JSON.stringify({
    sale_start: sale_start || null,
    sale_end: sale_end || null,
    archive_at: archive_at || null,
    promo_group: promo_group || null,
    promo_free: promo_free || null,
    unlisted: unlisted || false,
  });
  return cleanDetails + SALE_MARKER + config;
}

export function decodeSaleConfig(details: string): {
  details: string;
  sale_start: string | null;
  sale_end: string | null;
  archive_at: string | null;
  promo_group: number | null;
  promo_free: number | null;
  unlisted: boolean;
} {
  if (!details) return { details: "", sale_start: null, sale_end: null, archive_at: null, promo_group: null, promo_free: null, unlisted: false };
  const idx = details.indexOf(SALE_MARKER);
  if (idx === -1) return { details, sale_start: null, sale_end: null, archive_at: null, promo_group: null, promo_free: null, unlisted: false };
  const cleanDetails = details.slice(0, idx);
  try {
    const config = JSON.parse(details.slice(idx + SALE_MARKER.length));
    return {
      details: cleanDetails,
      sale_start: config.sale_start || null,
      sale_end: config.sale_end || null,
      archive_at: config.archive_at || null,
      promo_group: typeof config.promo_group === "number" ? config.promo_group : null,
      promo_free: typeof config.promo_free === "number" ? config.promo_free : null,
      unlisted: !!config.unlisted,
    };
  } catch {
    return { details: cleanDetails, sale_start: null, sale_end: null, archive_at: null, promo_group: null, promo_free: null, unlisted: false };
  }
}

export function stripSaleConfig(details: string): string {
  if (!details) return "";
  const idx = details.indexOf(SALE_MARKER);
  return idx === -1 ? details : details.slice(0, idx);
}
