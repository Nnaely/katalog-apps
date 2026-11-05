// Test utilities: load the real catalog and build complete fixture objects.
import fs from 'node:fs';

export function loadRealCatalog() {
  return JSON.parse(fs.readFileSync(new URL('../site/data/catalog.json', import.meta.url), 'utf8'));
}

export function loadPricelistSnapshot() {
  return fs.readFileSync(new URL('./fixtures/pricelist-2026-06-27.md', import.meta.url), 'utf8');
}

const LABEL = { day: 'hari', month: 'bulan', year: 'tahun' };

// Builders mirror every field of the real catalog.json structure.
export function offer(planId, value, unit, priceIdr, availability = 'available') {
  const label = unit === 'lifetime' ? 'Lifetime' : `${value} ${LABEL[unit]}`;
  const suffix = unit === 'lifetime' ? 'lifetime' : `${value}-${LABEL[unit]}`;
  return {
    id: `${planId}-${suffix}`, planId, durationValue: unit === 'lifetime' ? null : value, durationUnit: unit,
    durationLabel: label, priceIdr, availability, updatedAt: '2026-06-27', note: null, source: `${label} ${priceIdr}`,
  };
}

export function plan(productId, name, offers = [], status = 'active') {
  const id = `${productId}-${(name || 'paket').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return {
    id, productId, name, accessType: null, usageRules: null, warrantyTerms: null, warrantyPeriod: null,
    activationNotes: null, status, notes: [], source: { name: name || '—', variant: null },
    offers: offers.map(([v, u, p, a]) => offer(id, v, u, p, a)),
  };
}

export function product(id, category, plans = [], status = 'active') {
  return {
    id, slug: id, name: id.charAt(0).toUpperCase() + id.slice(1), category, shortDescription: 'Deskripsi.',
    description: null, image: null, monogram: id.charAt(0).toUpperCase(), status, updatedAt: '2026-06-27',
    source: { name: id, section: 'TEST' }, plans,
  };
}

export function catalog(products) {
  return {
    schemaVersion: 1,
    meta: { title: 'TEST', catalogUpdatedAt: '2026-06-27', currency: 'IDR', notes: '' },
    categories: [{ id: 'streaming', name: 'Streaming' }, { id: 'education', name: 'Education' }],
    products,
  };
}
