// Formatting helpers shared by the catalog, detail page, and WhatsApp drafts.

/** A price is valid only as a positive whole number of rupiah. */
export function isValidPrice(value) {
  return Number.isSafeInteger(value) && value > 0;
}

/** 40000 -> "Rp40.000". Returns null for anything that is not a valid price, so callers never show Rp0. */
export function formatRupiah(value) {
  if (!isValidPrice(value)) return null;
  return 'Rp' + String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Collapse any whitespace (including newlines/tabs) to single spaces and trim. */
export function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Lowercase, accent-free, whitespace-collapsed text for case-insensitive search. */
export function normalizeText(value) {
  return cleanText(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
