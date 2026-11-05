import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRupiah, isValidPrice, normalizeText } from '../site/assets/js/lib/format.js';

test('formatRupiah menulis Rp dengan titik ribuan, tanpa spasi dan desimal (FR09)', () => {
  const cases = [
    [40000, 'Rp40.000'], [6000, 'Rp6.000'], [5500, 'Rp5.500'],
    [120000, 'Rp120.000'], [1250000, 'Rp1.250.000'], [999, 'Rp999'],
  ];
  for (const [input, want] of cases) assert.equal(formatRupiah(input), want);
});

test('formatRupiah menolak harga kosong, nol, negatif, pecahan, atau teks agar tidak tampil Rp0 (FR02)', () => {
  for (const bad of [0, -5000, null, undefined, NaN, Infinity, 40000.5, '40000']) {
    assert.equal(formatRupiah(bad), null, `input ${String(bad)}`);
  }
});

test('isValidPrice hanya menerima bilangan bulat positif', () => {
  assert.equal(isValidPrice(40000), true);
  for (const bad of [0, -1, null, undefined, NaN, 1.5, '40000', Infinity]) {
    assert.equal(isValidPrice(bad), false, `input ${String(bad)}`);
  }
});

test('normalizeText menyamakan huruf besar-kecil, aksen, dan spasi berlebih', () => {
  assert.equal(normalizeText('  NetFLIX  '), 'netflix');
  assert.equal(normalizeText('Pokémon\tGO'), 'pokemon go');
  assert.equal(normalizeText(null), '');
});
