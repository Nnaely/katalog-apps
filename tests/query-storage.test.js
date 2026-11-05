import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogQuery, toCatalogSearch } from '../site/assets/js/lib/query.js';
import { createSelectionStore } from '../site/assets/js/lib/storage.js';

const CATS = ['streaming', 'education', 'editing', 'music', 'other'];

test('kueri dan kategori dibaca dari URL katalog', () => {
  assert.deepEqual(parseCatalogQuery('?q=net&kategori=streaming', CATS), { query: 'net', category: 'streaming' });
});

test('kategori tak dikenal atau kosong kembali ke "semua"', () => {
  assert.deepEqual(parseCatalogQuery('?kategori=game', CATS), { query: '', category: 'semua' });
  assert.deepEqual(parseCatalogQuery('', CATS), { query: '', category: 'semua' });
});

test('kueri dari URL dipangkas dan panjangnya dibatasi', () => {
  assert.equal(parseCatalogQuery('?q=%20%20canva%20', CATS).query, 'canva');
  const long = parseCatalogQuery('?q=' + 'a'.repeat(500), CATS).query;
  assert.ok(long.length > 0 && long.length <= 80, `panjang ${long.length}`);
});

test('toCatalogSearch hanya menulis parameter yang bukan bawaan', () => {
  assert.equal(toCatalogSearch({ query: '', category: 'semua' }), '');
  assert.equal(toCatalogSearch({ query: 'chat gpt', category: 'education' }), '?q=chat+gpt&kategori=education');
  assert.equal(toCatalogSearch({ query: '  ', category: 'music' }), '?kategori=music');
});

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

test('pilihan paket per produk tersimpan dan terbaca kembali dalam sesi yang sama', () => {
  const store = createSelectionStore(new MemoryStorage());
  store.save('netflix', { planId: 'a', offerId: 'b' });
  store.save('canva', { planId: 'c', offerId: null });
  assert.deepEqual(store.load('netflix'), { planId: 'a', offerId: 'b' });
  assert.deepEqual(store.load('canva'), { planId: 'c', offerId: null });
  assert.equal(store.load('viu'), null);
});

test('data sesi rusak, berbentuk salah, atau penyimpanan diblokir tidak menghentikan halaman', () => {
  const broken = new MemoryStorage();
  broken.setItem('kunci-uji', '{rusak');
  assert.equal(createSelectionStore(broken, 'kunci-uji').load('netflix'), null);

  const wrongShape = new MemoryStorage();
  wrongShape.setItem('kunci-uji', JSON.stringify({ netflix: { planId: 5, offerId: ['x'] } }));
  assert.equal(createSelectionStore(wrongShape, 'kunci-uji').load('netflix'), null);

  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  const s = createSelectionStore(blocked);
  assert.doesNotThrow(() => s.save('netflix', { planId: 'a', offerId: null }));
  assert.equal(s.load('netflix'), null);
  assert.equal(createSelectionStore(null).load('netflix'), null);
});
