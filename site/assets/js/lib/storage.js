// Keeps each product's plan/duration choice for the browser session (sessionStorage).
export const SELECTION_KEY = 'katalog-aplikasi:pilihan:v1';

const validId = value => value === null || (typeof value === 'string' && value.length > 0 && value.length < 200);

export function createSelectionStore(storage, key = SELECTION_KEY) {
  const readAll = () => {
    try {
      const raw = storage?.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };
  return {
    load(slug) {
      const all = readAll();
      const entry = Object.prototype.hasOwnProperty.call(all, slug) ? all[slug] : null;
      if (!entry || typeof entry !== 'object' || !validId(entry.planId ?? null) || !validId(entry.offerId ?? null)) return null;
      return { planId: entry.planId ?? null, offerId: entry.offerId ?? null };
    },
    save(slug, { planId = null, offerId = null } = {}) {
      try {
        const all = readAll();
        all[slug] = { planId, offerId };
        storage?.setItem(key, JSON.stringify(all));
      } catch {
        // Storage blocked or full: the choice simply is not remembered.
      }
    },
  };
}
