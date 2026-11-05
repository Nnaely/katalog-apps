// Beranda: katalog dengan pencarian + filter kategori, contoh draf, dan tanggal pembaruan.
import { filterProducts } from './lib/catalog.js';
import { formatRupiah } from './lib/format.js';
import { orderMessage } from './lib/whatsapp.js';
import { parseCatalogQuery, toCatalogSearch, ALL_CATEGORIES } from './lib/query.js';
import {
  bindStore, loadCatalog, el, icon, monogram, fillCatalogDate, helpLink, rememberCatalogSearch,
} from './ui.js';

const grid = document.querySelector('[data-product-grid]');
const stateBox = document.querySelector('[data-catalog-state]');
const countEl = document.querySelector('[data-result-count]');
const chipsBox = document.querySelector('[data-category-chips]');
const form = document.querySelector('[data-search-form]');
const input = document.querySelector('#search-input');
const clearButton = document.querySelector('[data-search-clear]');

let catalog = null;
let view = { query: '', category: ALL_CATEGORIES };
let countTimer;

function renderLoading() {
  stateBox.replaceChildren();
  grid.setAttribute('aria-busy', 'true');
  grid.replaceChildren(...Array.from({ length: 8 }, () => el('li', { class: 'product-card is-skeleton', 'aria-hidden': 'true' },
    el('span', { class: 'mono' }),
    el('span', { class: 'card-main' }, el('span', { class: 'sk-line' }), el('span', { class: 'sk-line sk-line--short' })),
  )));
  countEl.textContent = 'Memuat katalog…';
}

function renderLoadError() {
  grid.removeAttribute('aria-busy');
  grid.replaceChildren();
  countEl.textContent = '';
  stateBox.replaceChildren(el('div', { class: 'notice', dataset: { tone: 'error' }, role: 'alert' },
    icon('alert'),
    el('div', { class: 'notice-body' },
      el('p', { class: 'notice-title', text: 'Katalog tidak dapat dimuat.' }),
      el('p', { text: 'Periksa koneksi internet, lalu muat ulang katalog. Anda juga bisa langsung bertanya ke admin lewat WhatsApp.' }),
      el('div', { class: 'notice-actions' },
        el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: start }, icon('refresh'), el('span', {}, 'Muat ulang katalog')),
        helpLink('Tanya admin', 'btn btn-secondary btn-sm'),
      ),
    ),
  ));
}

function categoryName(id) {
  return catalog.categories.find(c => c.id === id)?.name ?? '';
}

function renderChips() {
  const all = [{ id: ALL_CATEGORIES, name: 'Semua' }, ...catalog.categories];
  chipsBox.replaceChildren(...all.map(c => {
    const count = c.id === ALL_CATEGORIES ? catalog.products.length : catalog.products.filter(p => p.category === c.id).length;
    const radio = el('input', { type: 'radio', name: 'kategori', value: c.id, class: 'chip-input' });
    radio.checked = view.category === c.id;
    radio.addEventListener('change', () => {
      view = { ...view, category: c.id };
      update();
    });
    return el('label', { class: 'chip' }, radio,
      el('span', { class: 'chip-body' }, c.name,
        el('span', { class: 'chip-count' }, String(count), el('span', { class: 'visually-hidden', text: ' produk' }))));
  }));
}

function priceBlock(p) {
  if (p.startingPrice !== null) {
    return el('p', { class: 'card-price' },
      el('span', { class: 'price-from', text: 'Mulai' }),
      el('span', { class: 'price-value', text: formatRupiah(p.startingPrice) }));
  }
  let label = 'Hubungi admin';
  if (!p.plans.length) label = 'Hubungi admin untuk informasi';
  else if (p.status !== 'active') label = 'Sedang tidak tersedia';
  else {
    const offers = p.plans.flatMap(pl => pl.offers);
    if (offers.length && offers.every(o => o.effectiveAvailability === 'sold_out')) label = 'Stok habis';
  }
  return el('p', { class: 'card-price' }, el('span', { class: 'pill-ask' }, icon('chat'), el('span', {}, label)));
}

function card(p, index) {
  const planCount = p.plans.length;
  return el('li', { class: 'product-card' },
    monogram(p),
    el('div', { class: 'card-main' },
      el('h3', { class: 'card-title' },
        el('a', { class: 'card-link', href: `produk?p=${encodeURIComponent(p.slug)}` }, p.name)),
      el('p', { class: 'card-desc', text: p.shortDescription ?? '' }),
      el('p', { class: 'card-meta' },
        el('span', { class: 'badge badge-cat', text: categoryName(p.category) || 'Lainnya' }),
        planCount ? el('span', { class: 'plan-count', text: `${planCount} paket` }) : null),
    ),
    priceBlock(p),
  );
}

function describeCount(results) {
  const total = catalog.products.length;
  if (!view.query && view.category === ALL_CATEGORIES) return `Menampilkan ${total} aplikasi.`;
  let text = `Menampilkan ${results.length} dari ${total} aplikasi`;
  if (view.query) text += ` untuk “${view.query}”`;
  if (view.category !== ALL_CATEGORIES) text += ` di kategori ${categoryName(view.category)}`;
  return `${text}.`;
}

function resetFilters() {
  view = { query: '', category: ALL_CATEGORIES };
  input.value = '';
  chipsBox.querySelectorAll('.chip-input').forEach(r => { r.checked = r.value === ALL_CATEGORIES; });
  update();
  input.focus();
}

function renderEmpty() {
  const where = view.category !== ALL_CATEGORIES ? ` di kategori ${categoryName(view.category)}` : '';
  const title = view.query
    ? `Tidak ada aplikasi yang cocok dengan “${view.query}”${where}.`
    : `Belum ada aplikasi${where}.`;
  stateBox.replaceChildren(el('div', { class: 'empty' },
    el('p', { class: 'empty-title', text: title }),
    el('p', { text: 'Coba kata lain, periksa ejaan, atau tampilkan semua kategori. Aplikasi yang dicari belum ada? Tanyakan ke admin.' }),
    el('div', { class: 'notice-actions' },
      el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: resetFilters, 'data-reset': '' }, 'Reset pencarian'),
      helpLink('Tanya admin', 'btn btn-secondary btn-sm'),
    ),
  ));
}

function update() {
  const results = filterProducts(catalog.products, view);
  grid.removeAttribute('aria-busy');
  grid.replaceChildren(...results.map((p, i) => card(p, i)));
  if (results.length) stateBox.replaceChildren();
  else renderEmpty();
  clearButton.hidden = !view.query;

  clearTimeout(countTimer);
  countTimer = setTimeout(() => { countEl.textContent = describeCount(results); }, 250);

  const search = toCatalogSearch(view);
  history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`);
  rememberCatalogSearch(search);
}

function renderDemo() {
  const bubble = document.querySelector('[data-demo-message]');
  if (!bubble) return;
  const p = catalog.getProduct('netflix');
  const plan = p?.plans.find(pl => pl.name === '1P1U');
  let pick = plan?.offers.find(o => o.durationLabel === '1 bulan' && o.orderable) ? { p, plan, offer: plan.offers.find(o => o.durationLabel === '1 bulan') } : null;
  if (!pick) {
    for (const prod of catalog.products) {
      for (const pl of prod.plans) {
        const offer = pl.offers.find(o => o.orderable);
        if (offer) { pick = { p: prod, plan: pl, offer }; break; }
      }
      if (pick) break;
    }
  }
  if (!pick) { bubble.closest('.hero-demo').hidden = true; return; }
  bubble.textContent = orderMessage({
    productName: pick.p.name, planName: pick.plan.name, durationLabel: pick.offer.durationLabel, priceIdr: pick.offer.priceIdr,
  });
}

async function start() {
  renderLoading();
  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.error('Katalog gagal dimuat:', error);
    renderLoadError();
    return;
  }
  view = parseCatalogQuery(location.search, catalog.categories.map(c => c.id));
  input.value = view.query;
  renderChips();
  fillCatalogDate(catalog);
  renderDemo();
  update();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  input.blur();
});
input.addEventListener('input', () => {
  if (!catalog) return;
  view = { ...view, query: input.value.slice(0, 80) };
  update();
});
clearButton.addEventListener('click', () => {
  input.value = '';
  view = { ...view, query: '' };
  if (catalog) update();
  input.focus();
});

bindStore(document);
start();
