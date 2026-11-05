// Shared DOM helpers. Catalog text is always inserted as text nodes (never innerHTML).
import { STORE } from './store.js';
import { helpUrl } from './lib/whatsapp.js';
import { prepareCatalog } from './lib/catalog.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  chat: 'M4 11.5a7.5 7.5 0 1 1 3.4 6.3L4 19l1.1-3.6A7.4 7.4 0 0 1 4 11.5ZM9 11.5h.01M12 11.5h.01M15 11.5h.01',
  copy: 'M9 8.5A1.5 1.5 0 0 1 10.5 7h8A1.5 1.5 0 0 1 20 8.5v11a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 19.5ZM15 4H5.5A1.5 1.5 0 0 0 4 5.5V16',
  check: 'M5 12.5l4.2 4.2L19 7',
  search: 'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  alert: 'M12 4 2.8 19.5h18.4ZM12 10v4.5M12 17.2h.01',
  shield: 'M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6Z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
};

export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', className);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/** Tiny element builder: strings become text nodes, so data can never inject markup. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (typeof value === 'boolean') node.toggleAttribute(key, value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function monogram(product, className = 'mono') {
  return el('span', { class: className, 'aria-hidden': 'true', dataset: { cat: product.category ?? 'other' } }, product.monogram || product.name.charAt(0));
}

/** App icon when the catalog has one; falls back to the monogram if missing or it fails to load. */
export function productVisual(product, { large = false, eager = false } = {}) {
  const fallback = () => monogram(product, large ? 'mono mono--lg' : 'mono');
  if (!product.image) return fallback();
  const size = large ? 76 : 52;
  const img = el('img', {
    class: large ? 'logo logo--lg' : 'logo', src: product.image, alt: '', width: String(size), height: String(size),
    loading: eager ? 'eager' : 'lazy', decoding: 'async',
  });
  img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
  return img;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export function formatDateId(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : null;
}

export function fillCatalogDate(catalog, root = document) {
  const date = formatDateId(catalog?.meta?.catalogUpdatedAt);
  root.querySelectorAll('[data-catalog-updated]').forEach(node => { node.textContent = date ?? 'belum tercatat'; });
}

export async function loadCatalog({ timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(STORE.catalogUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return prepareCatalog(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export function whatsappLink(href, label, className = 'btn btn-secondary') {
  return el('a', { class: className, href, target: '_blank', rel: 'noopener noreferrer' }, icon('chat'), el('span', {}, label));
}

export function helpLink(label = 'Tanya admin', className) {
  const link = whatsappLink(helpUrl(STORE.whatsappNumber), label, className);
  link.addEventListener('click', () => track('whatsapp_click', { type: 'help' }));
  return link;
}

/** Optional analytics hook: pushes interest events only (never message text or buyer identity). */
export function track(event, data = {}) {
  if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event, ...data });
}

export async function copyText(text) {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below.
  }
  try {
    const proxy = el('textarea', { class: 'clipboard-proxy', readonly: true, tabindex: '-1', 'aria-hidden': 'true' });
    proxy.value = text;
    document.body.append(proxy);
    proxy.select();
    const ok = document.execCommand('copy');
    proxy.remove();
    return ok;
  } catch {
    return false;
  }
}

let toastTimer;
/** Visible + screen-reader announcement for short confirmations. */
export function announce(message) {
  const toast = document.querySelector('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
}

const BACK_KEY = 'katalog-aplikasi:katalog';
export function rememberCatalogSearch(search) {
  try { sessionStorage.setItem(BACK_KEY, search); } catch { /* not critical */ }
}
export function catalogBackHref() {
  let search = '';
  try { search = sessionStorage.getItem(BACK_KEY) ?? ''; } catch { /* default */ }
  return `./${search.startsWith('?') ? search : ''}#produk`;
}

/** Fills store name/number placeholders and wires help links and "copy number" buttons. */
export function bindStore(root = document) {
  root.querySelectorAll('[data-store="name"]').forEach(node => { node.textContent = STORE.name; });
  root.querySelectorAll('[data-store="phone"]').forEach(node => { node.textContent = STORE.whatsappDisplay; });
  const href = helpUrl(STORE.whatsappNumber);
  root.querySelectorAll('a[data-wa="help"]').forEach(link => {
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => track('whatsapp_click', { type: 'help' }));
  });
  root.querySelectorAll('[data-copy="phone"]').forEach(button => {
    button.addEventListener('click', async () => {
      const ok = await copyText(STORE.whatsappDisplay);
      announce(ok ? `Nomor admin ${STORE.whatsappDisplay} disalin.` : `Tidak bisa menyalin otomatis. Catat nomor admin: ${STORE.whatsappDisplay}`);
    });
  });
}

export function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
