// Catalog validation (for maintainers) and preparation (for the pages).
import { isValidPrice, normalizeText } from './format.js';

export const DURATION_UNITS = ['day', 'month', 'year', 'lifetime'];
export const AVAILABILITY = ['available', 'sold_out', 'needs_confirmation', 'inactive'];
const STATUSES = ['active', 'inactive'];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Local raster files under assets/ only: no external URLs, no "..", no SVG (could carry scripts).
const IMAGE_PATTERN = /^assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g)$/i;
export const isSafeImagePath = value => typeof value === 'string' && IMAGE_PATTERN.test(value);

export class CatalogError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CatalogError';
  }
}

const isCatalogShape = data =>
  !!data && typeof data === 'object' && !Array.isArray(data) &&
  Array.isArray(data.categories) && Array.isArray(data.products);

/**
 * Strict checks for whoever edits catalog.json. Returns readable messages that name the offending id.
 */
export function validateCatalog(data) {
  const errors = [];
  const warnings = [];
  if (!isCatalogShape(data)) {
    return { errors: ['Struktur katalog tidak dikenali: butuh objek dengan array "categories" dan "products".'], warnings };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.meta?.catalogUpdatedAt ?? '')) {
    warnings.push('meta.catalogUpdatedAt sebaiknya berformat YYYY-MM-DD.');
  }
  const categoryIds = new Set(data.categories.map(c => c?.id));
  const seen = { product: new Set(), slug: new Set(), plan: new Set(), offer: new Set() };

  for (const p of data.products) {
    const pid = p?.id ?? '(tanpa id)';
    if (!p?.id) errors.push(`Produk tanpa id: ${JSON.stringify(p?.name)}`);
    else if (seen.product.has(p.id)) errors.push(`Id produk ganda: ${p.id}`);
    seen.product.add(p?.id);
    if (!SLUG_PATTERN.test(p?.slug ?? '')) errors.push(`Slug produk ${pid} tidak valid: "${p?.slug}"`);
    else if (seen.slug.has(p.slug)) errors.push(`Slug produk ganda: ${p.slug} (${pid})`);
    seen.slug.add(p?.slug);
    if (typeof p?.name !== 'string' || !p.name.trim()) errors.push(`Produk ${pid} tidak punya nama`);
    if (!categoryIds.has(p?.category)) errors.push(`Kategori tidak dikenal pada ${pid}: "${p?.category}"`);
    if (!STATUSES.includes(p?.status)) errors.push(`Status produk ${pid} tidak dikenal: "${p?.status}"`);
    if (p?.image != null && !isSafeImagePath(p.image)) {
      errors.push(`Gambar produk ${pid} tidak valid: "${p.image}". Gunakan file lokal di folder assets, misalnya assets/logos/${pid}.webp.`);
    }
    if (!Array.isArray(p?.plans)) { errors.push(`Produk ${pid} tidak punya array "plans"`); continue; }

    const planNames = new Set();
    for (const pl of p.plans) {
      const plid = pl?.id ?? '(tanpa id)';
      if (!pl?.id) errors.push(`Paket tanpa id pada ${pid}`);
      else if (seen.plan.has(pl.id)) errors.push(`Id paket ganda: ${pl.id}`);
      seen.plan.add(pl?.id);
      if (pl?.productId !== p.id) errors.push(`Paket ${plid} merujuk produk "${pl?.productId}", seharusnya "${p.id}"`);
      if (!STATUSES.includes(pl?.status)) errors.push(`Status paket ${plid} tidak dikenal: "${pl?.status}"`);
      const nameKey = pl?.name ?? '';
      if (planNames.has(nameKey)) errors.push(`Nama paket ganda pada ${pid}: "${nameKey}"`);
      planNames.add(nameKey);
      if (!pl?.name && p.plans.length > 1) errors.push(`Paket tanpa nama pada ${pid} hanya boleh bila produk punya satu paket`);
      if (!Array.isArray(pl?.offers)) { errors.push(`Paket ${plid} tidak punya array "offers"`); continue; }
      if (pl.offers.length === 0) warnings.push(`Paket ${plid} belum punya durasi`);

      const durations = new Set();
      for (const o of pl.offers) {
        const oid = o?.id ?? '(tanpa id)';
        if (!o?.id) errors.push(`Penawaran tanpa id pada ${plid}`);
        else if (seen.offer.has(o.id)) errors.push(`Id penawaran ganda: ${o.id}`);
        seen.offer.add(o?.id);
        if (o?.planId !== pl.id) errors.push(`Penawaran ${oid} merujuk paket "${o?.planId}", seharusnya "${pl.id}"`);
        if (!DURATION_UNITS.includes(o?.durationUnit)) {
          errors.push(`Satuan durasi ${oid} tidak dikenal: "${o?.durationUnit}"`);
        } else if (o.durationUnit === 'lifetime') {
          if (o.durationValue !== null) errors.push(`Penawaran lifetime ${oid} tidak boleh punya angka durasi (${o.durationValue})`);
        } else if (!Number.isSafeInteger(o.durationValue) || o.durationValue <= 0) {
          errors.push(`Angka durasi ${oid} tidak valid: ${o.durationValue}`);
        }
        if (typeof o?.durationLabel !== 'string' || !o.durationLabel.trim()) errors.push(`Penawaran ${oid} tidak punya label durasi`);
        const key = `${o?.durationUnit}:${o?.durationValue}`;
        if (durations.has(key)) errors.push(`Durasi ganda pada paket ${plid}: ${o?.durationLabel}`);
        durations.add(key);
        if (!AVAILABILITY.includes(o?.availability)) errors.push(`Status ketersediaan ${oid} tidak dikenal: "${o?.availability}"`);
        if (o?.priceIdr !== null && !isValidPrice(o?.priceIdr)) errors.push(`Harga ${oid} harus bilangan bulat positif atau null: ${o?.priceIdr}`);
        if (o?.availability === 'available' && !isValidPrice(o?.priceIdr)) {
          errors.push(`Penawaran ${oid} berstatus available tetapi harganya tidak valid (${o?.priceIdr})`);
        }
      }
    }
  }
  return { errors, warnings };
}

function effectiveAvailability(productActive, planActive, offer) {
  if (!productActive || !planActive) return 'inactive';
  if (!AVAILABILITY.includes(offer.availability)) return 'inactive';
  if (offer.availability === 'available' && !isValidPrice(offer.priceIdr)) return 'needs_confirmation';
  return offer.availability;
}

const lowestOrderablePrice = offers => {
  const prices = offers.filter(o => o.orderable).map(o => o.priceIdr);
  return prices.length ? Math.min(...prices) : null;
};

/**
 * Defensive copy for rendering: unusable entries are skipped, invalid prices become null,
 * and every offer gets `effectiveAvailability` + `orderable`. Throws CatalogError if the data is not a catalog.
 */
export function prepareCatalog(data) {
  if (!isCatalogShape(data)) throw new CatalogError('Data katalog tidak dapat dibaca.');
  const categories = data.categories
    .filter(c => c && typeof c.id === 'string' && typeof c.name === 'string')
    .map(c => ({ id: c.id, name: c.name }));
  const categoryIds = new Set(categories.map(c => c.id));
  const products = [];
  const bySlug = new Map();

  for (const raw of data.products) {
    if (!raw || typeof raw.slug !== 'string' || typeof raw.name !== 'string' || bySlug.has(raw.slug)) continue;
    const productActive = raw.status === 'active';
    const plans = (Array.isArray(raw.plans) ? raw.plans : [])
      .filter(pl => pl && typeof pl.id === 'string')
      .map(pl => {
        const planActive = pl.status === 'active';
        const offers = (Array.isArray(pl.offers) ? pl.offers : [])
          .filter(o => o && typeof o.id === 'string' && typeof o.durationLabel === 'string')
          .map(o => {
            const availability = effectiveAvailability(productActive, planActive, o);
            return {
              ...o,
              priceIdr: isValidPrice(o.priceIdr) ? o.priceIdr : null,
              effectiveAvailability: availability,
              orderable: availability === 'available',
            };
          });
        return {
          ...pl,
          notes: Array.isArray(pl.notes) ? pl.notes.filter(n => typeof n === 'string') : [],
          offers,
          startingPrice: lowestOrderablePrice(offers),
        };
      });
    const product = {
      ...raw,
      image: isSafeImagePath(raw.image) ? raw.image : null,
      category: categoryIds.has(raw.category) ? raw.category : null,
      plans,
      startingPrice: lowestOrderablePrice(plans.flatMap(pl => pl.offers)),
    };
    products.push(product);
    bySlug.set(product.slug, product);
  }

  return {
    meta: { ...(data.meta || {}) },
    categories,
    products,
    getProduct: slug => bySlug.get(slug) ?? null,
  };
}

const compact = text => text.replace(/[^a-z0-9]/g, '');

/** Case-insensitive name search combined with an optional category ("semua" = all). */
export function filterProducts(products, { query = '', category = 'semua' } = {}) {
  const q = normalizeText(query);
  const compactQ = compact(q);
  return products.filter(p => {
    if (category && category !== 'semua' && p.category !== category) return false;
    if (!q) return true;
    const name = normalizeText(p.name);
    return name.includes(q) || (compactQ !== '' && compact(name).includes(compactQ));
  });
}
