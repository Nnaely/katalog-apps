// Catalog search/filter state kept in the URL (?q=...&kategori=...) so back navigation and sharing keep it.
export const ALL_CATEGORIES = 'semua';
const MAX_QUERY_LENGTH = 80;

export function parseCatalogQuery(search, categoryIds) {
  const params = new URLSearchParams(search || '');
  const query = (params.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH).trim();
  const category = params.get('kategori');
  return { query, category: categoryIds.includes(category) ? category : ALL_CATEGORIES };
}

export function toCatalogSearch({ query, category }) {
  const params = new URLSearchParams();
  const q = String(query ?? '').trim();
  if (q) params.set('q', q);
  if (category && category !== ALL_CATEGORIES) params.set('kategori', category);
  const search = params.toString();
  return search ? `?${search}` : '';
}
