import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppUrl, orderMessage, priceInquiryMessage, stockInquiryMessage, helpUrl,
} from '../site/assets/js/lib/whatsapp.js';

const NUMBER = '6285724590854';
const PRD_MESSAGE = 'Halo, saya tertarik membeli Netflix paket 1P1U untuk durasi 1 bulan. Harga yang tertera Rp40.000. Apakah tersedia?';
// Exact link from the PRD document ("Buka contoh tautan WhatsApp dengan draf Netflix").
const PRD_URL = 'https://wa.me/6285724590854?text=Halo%2C%20saya%20tertarik%20membeli%20Netflix%20paket%201P1U%20untuk%20durasi%201%20bulan.%20Harga%20yang%20tertera%20Rp40.000.%20Apakah%20tersedia%3F';

test('orderMessage mengikuti template PRD (contoh Netflix 1P1U 1 bulan)', () => {
  assert.equal(
    orderMessage({ productName: 'Netflix', planName: '1P1U', durationLabel: '1 bulan', priceIdr: 40000 }),
    PRD_MESSAGE,
  );
});

test('buildWhatsAppUrl menghasilkan tautan contoh PRD persis', () => {
  assert.equal(buildWhatsAppUrl(NUMBER, PRD_MESSAGE), PRD_URL);
});

test('buildWhatsAppUrl meng-encode spasi, simbol, emoji, dan baris baru tepat satu kali (UAT03)', () => {
  const msg = 'A & B + C #1 ?x=1 100% ✅\nbaris kedua';
  const url = buildWhatsAppUrl(NUMBER, msg);
  assert.equal(url, 'https://wa.me/6285724590854?text=A%20%26%20B%20%2B%20C%20%231%20%3Fx%3D1%20100%25%20%E2%9C%85%0Abaris%20kedua');
  assert.equal(decodeURIComponent(url.slice(url.indexOf('?text=') + 6)), msg);
});

test('buildWhatsAppUrl menolak nomor yang memakai plus, spasi, tanda hubung, awalan 0, atau kosong', () => {
  for (const bad of ['+6285724590854', '62 857 2459 0854', '62-857-2459-0854', '085724590854', '', null]) {
    assert.throws(() => buildWhatsAppUrl(bad, 'Halo'), /nomor/i, `nomor ${String(bad)}`);
  }
});

test('helpUrl memakai draf pertanyaan umum dari PRD (FR10)', () => {
  assert.equal(
    helpUrl(NUMBER),
    'https://wa.me/6285724590854?text=Halo%2C%20saya%20ingin%20bertanya%20tentang%20produk%20dan%20paket%20yang%20tersedia.',
  );
});

test('orderMessage tanpa nama paket tidak menulis kata "paket" kosong', () => {
  assert.equal(
    orderMessage({ productName: 'Goodnotes', planName: null, durationLabel: '1 tahun', priceIdr: 40000 }),
    'Halo, saya tertarik membeli Goodnotes untuk durasi 1 tahun. Harga yang tertera Rp40.000. Apakah tersedia?',
  );
});

test('orderMessage menolak harga tidak valid sehingga tidak ada draf pesanan Rp0 (UAT05)', () => {
  for (const bad of [0, null, undefined, -1]) {
    assert.throws(() => orderMessage({ productName: 'Netflix', planName: '1P1U', durationLabel: '1 bulan', priceIdr: bad }));
  }
});

test('orderMessage merapikan spasi dan baris baru yang terbawa dari data katalog', () => {
  assert.equal(
    orderMessage({ productName: ' Netflix\n', planName: '1P1U  ', durationLabel: '1\tbulan', priceIdr: 40000 }),
    PRD_MESSAGE,
  );
});

test('priceInquiryMessage mengikuti draf PRD untuk harga belum tersedia', () => {
  assert.equal(priceInquiryMessage('Lightroom'), 'Halo, saya ingin menanyakan paket, durasi, dan harga untuk Lightroom.');
});

test('stockInquiryMessage mengikuti draf PRD untuk stok habis, termasuk paket tanpa nama', () => {
  assert.equal(
    stockInquiryMessage({ productName: 'Netflix', planName: '1P1U', durationLabel: '1 bulan' }),
    'Halo, apakah Netflix paket 1P1U untuk 1 bulan sudah tersedia kembali?',
  );
  assert.equal(
    stockInquiryMessage({ productName: 'Goodnotes', planName: null, durationLabel: '1 tahun' }),
    'Halo, apakah Goodnotes untuk 1 tahun sudah tersedia kembali?',
  );
});
