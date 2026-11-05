// WhatsApp click-to-chat links and the draft messages defined in the PRD.
import { cleanText, formatRupiah } from './format.js';

export const HELP_MESSAGE = 'Halo, saya ingin bertanya tentang produk dan paket yang tersedia.';

// International format without "+", spaces, or hyphens (e.g. 6285128045094).
const NUMBER_PATTERN = /^[1-9]\d{7,14}$/;

export function buildWhatsAppUrl(number, message) {
  if (typeof number !== 'string' || !NUMBER_PATTERN.test(number)) {
    throw new TypeError(
      `Format nomor WhatsApp tidak valid: "${number}". Gunakan kode negara tanpa plus, spasi, atau tanda hubung, misalnya 6285128045094.`,
    );
  }
  const text = String(message ?? '');
  // Encode the whole message exactly once.
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
}

export function helpUrl(number) {
  return buildWhatsAppUrl(number, HELP_MESSAGE);
}

const planPart = planName => {
  const name = cleanText(planName);
  return name ? ` paket ${name}` : '';
};

/** Order draft. Throws when the price is not valid so an Rp0 order can never be drafted. */
export function orderMessage({ productName, planName, durationLabel, priceIdr }) {
  const price = formatRupiah(priceIdr);
  if (!price) throw new RangeError('Draf pesanan membutuhkan harga yang valid.');
  return `Halo, saya tertarik membeli ${cleanText(productName)}${planPart(planName)} untuk durasi ${cleanText(durationLabel)}. Harga yang tertera ${price}. Apakah tersedia?`;
}

export function priceInquiryMessage(productName) {
  return `Halo, saya ingin menanyakan paket, durasi, dan harga untuk ${cleanText(productName)}.`;
}

export function stockInquiryMessage({ productName, planName, durationLabel }) {
  return `Halo, apakah ${cleanText(productName)}${planPart(planName)} untuk ${cleanText(durationLabel)} sudah tersedia kembali?`;
}
