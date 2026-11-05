import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, prepareCatalog, CatalogError, filterProducts } from '../site/assets/js/lib/catalog.js';
import { catalog, product, plan } from './helpers.js';

const valid = () => catalog([
  product('alpha', 'streaming', [plan('alpha', 'Sharing', [[1, 'month', 15000], [3, 'month', 30000]])]),
  product('beta', 'education', []),
]);

test('validateCatalog menerima katalog yang konsisten', () => {
  assert.deepEqual(validateCatalog(valid()).errors, []);
});

test('validateCatalog menolak durasi ganda dalam satu paket (kombinasi paket+durasi harus unik)', () => {
  const c = valid();
  const first = c.products[0].plans[0].offers[0];
  c.products[0].plans[0].offers.push({ ...first, id: 'alpha-sharing-1-bulan-b', priceIdr: 16000 });
  const { errors } = validateCatalog(c);
  assert.ok(errors.some(e => e.includes('alpha-sharing') && /durasi/i.test(e)), errors.join('\n'));
});

test('validateCatalog menolak penawaran tersedia dengan harga nol, kosong, atau negatif', () => {
  for (const bad of [0, null, -1000]) {
    const c = valid();
    c.products[0].plans[0].offers[0].priceIdr = bad;
    const { errors } = validateCatalog(c);
    assert.ok(errors.some(e => e.includes('alpha-sharing-1-bulan')), `harga ${bad}: ${errors.join('\n')}`);
  }
});

test('validateCatalog menolak kategori, satuan durasi, dan status yang tidak dikenal', () => {
  const c = valid();
  c.products[0].category = 'game';
  c.products[0].plans[0].offers[0].durationUnit = 'week';
  c.products[0].plans[0].offers[1].availability = 'maybe';
  const { errors } = validateCatalog(c);
  for (const word of ['game', 'week', 'maybe']) {
    assert.ok(errors.some(e => e.includes(word)), `${word}: ${errors.join('\n')}`);
  }
});

test('validateCatalog menolak slug produk ganda dan relasi id yang salah', () => {
  const c = valid();
  c.products[1].slug = 'alpha';
  c.products[0].plans[0].offers[0].planId = 'paket-lain';
  const { errors } = validateCatalog(c);
  assert.ok(errors.some(e => /slug/i.test(e) && e.includes('alpha')), errors.join('\n'));
  assert.ok(errors.some(e => e.includes('paket-lain')), errors.join('\n'));
});

test('validateCatalog menerima lifetime tanpa angka durasi dan menolak lifetime berangka', () => {
  const c = catalog([product('gamma', 'streaming', [plan('gamma', 'Lifetime', [[null, 'lifetime', 30000]])])]);
  assert.deepEqual(validateCatalog(c).errors, []);
  c.products[0].plans[0].offers[0].durationValue = 6;
  assert.ok(validateCatalog(c).errors.some(e => /lifetime/i.test(e)));
});

test('validateCatalog hanya menerima gambar lokal di folder assets (bukan URL luar atau path keluar folder)', () => {
  const ok = valid();
  ok.products[0].image = 'assets/logos/alpha.webp';
  assert.deepEqual(validateCatalog(ok).errors, []);
  for (const bad of ['https://contoh.com/logo.png', 'javascript:alert(1)', '../rahasia.png', 'assets/../../x.webp', 'assets/logos/alpha.gif', 42]) {
    const c = valid();
    c.products[0].image = bad;
    assert.ok(validateCatalog(c).errors.some(e => e.includes('alpha') && /gambar/i.test(e)), `image ${bad}`);
  }
});

test('prepareCatalog mengosongkan gambar yang tidak aman sehingga halaman memakai monogram', () => {
  const c = valid();
  c.products[0].image = 'https://contoh.com/pelacak.png';
  c.products[1].image = 'assets/logos/beta.webp';
  const prepared = prepareCatalog(c);
  assert.equal(prepared.getProduct('alpha').image, null);
  assert.equal(prepared.getProduct('beta').image, 'assets/logos/beta.webp');
});

test('prepareCatalog menolak data yang tidak berbentuk katalog (jalur "data gagal dimuat")', () => {
  for (const bad of [null, {}, { products: 'x' }, [], 'teks']) {
    assert.throws(() => prepareCatalog(bad), CatalogError, `input ${JSON.stringify(bad)}`);
  }
});

test('penawaran berstatus tersedia tetapi berharga nol diperlakukan perlu konfirmasi dan tidak bisa dipesan', () => {
  const prepared = prepareCatalog(catalog([product('alpha', 'streaming', [plan('alpha', 'Private', [[1, 'month', 0]])])]));
  const o = prepared.getProduct('alpha').plans[0].offers[0];
  assert.equal(o.effectiveAvailability, 'needs_confirmation');
  assert.equal(o.orderable, false);
});

test('status yang tidak dikenal tidak pernah bisa dipesan', () => {
  const prepared = prepareCatalog(catalog([product('alpha', 'streaming', [plan('alpha', 'Sharing', [[1, 'month', 15000, 'maybe']])])]));
  assert.equal(prepared.getProduct('alpha').plans[0].offers[0].orderable, false);
});

test('harga mulai hanya dari penawaran aktif dengan harga valid (FR02)', () => {
  const prepared = prepareCatalog(catalog([
    product('alpha', 'streaming', [
      plan('alpha', 'Sharing', [[1, 'month', 15000, 'sold_out'], [3, 'month', 30000]]),
      plan('alpha', 'Private', [[1, 'month', 0]]),
      plan('alpha', 'Family', [[1, 'month', 9000]], 'inactive'),
    ]),
    product('beta', 'education', []),
    product('gamma', 'streaming', [plan('gamma', 'Sharing', [[1, 'month', 10000]])], 'inactive'),
  ]));
  const alpha = prepared.getProduct('alpha');
  assert.equal(alpha.startingPrice, 30000);
  assert.equal(alpha.plans[0].startingPrice, 30000);
  assert.equal(alpha.plans[1].startingPrice, null);
  assert.equal(prepared.getProduct('beta').startingPrice, null);
  assert.equal(prepared.getProduct('gamma').startingPrice, null);
});

test('getProduct mengembalikan null untuk slug yang tidak ada', () => {
  assert.equal(prepareCatalog(valid()).getProduct('tidak-ada'), null);
});

function searchFixture() {
  const named = (id, name, cat) => ({ ...product(id, cat), name });
  return prepareCatalog(catalog([
    named('netflix', 'Netflix', 'streaming'),
    named('chatgpt-go', 'ChatGPT Go', 'education'),
    named('chatgpt-plus', 'ChatGPT Plus', 'education'),
    named('mango-tv', 'Mango TV', 'streaming'),
  ])).products;
}
const names = list => list.map(p => p.name);

test('pencarian tidak membedakan huruf besar-kecil (FR01)', () => {
  assert.deepEqual(names(filterProducts(searchFixture(), { query: 'NETFLIX' })), ['Netflix']);
  assert.deepEqual(names(filterProducts(searchFixture(), { query: '  netFlix ' })), ['Netflix']);
});

test('pencarian dan filter kategori dapat dipakai bersamaan (FR01)', () => {
  const all = searchFixture();
  assert.deepEqual(names(filterProducts(all, { query: 'chat', category: 'education' })), ['ChatGPT Go', 'ChatGPT Plus']);
  assert.deepEqual(names(filterProducts(all, { query: 'chat', category: 'streaming' })), []);
  assert.deepEqual(names(filterProducts(all, { query: '', category: 'streaming' })), ['Netflix', 'Mango TV']);
});

test('kategori "semua" dengan kueri kosong menampilkan seluruh produk', () => {
  assert.equal(filterProducts(searchFixture(), { query: '', category: 'semua' }).length, 4);
});

test('pencarian tetap cocok saat pengguna menambah atau menghilangkan spasi', () => {
  const all = searchFixture();
  assert.deepEqual(names(filterProducts(all, { query: 'chat gpt plus' })), ['ChatGPT Plus']);
  assert.deepEqual(names(filterProducts(all, { query: 'mangotv' })), ['Mango TV']);
});
