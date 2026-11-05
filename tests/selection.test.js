import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCatalog } from '../site/assets/js/lib/catalog.js';
import { initialSelection, choosePlan, chooseOffer, describeSelection } from '../site/assets/js/lib/selection.js';
import { loadRealCatalog, catalog, product, plan } from './helpers.js';

const NUMBER = '6285724590854';
const PRD_MESSAGE = 'Halo, saya tertarik membeli Netflix paket 1P1U untuk durasi 1 bulan. Harga yang tertera Rp40.000. Apakah tersedia?';
const PRD_URL = 'https://wa.me/6285724590854?text=Halo%2C%20saya%20tertarik%20membeli%20Netflix%20paket%201P1U%20untuk%20durasi%201%20bulan.%20Harga%20yang%20tertera%20Rp40.000.%20Apakah%20tersedia%3F';

const real = prepareCatalog(loadRealCatalog());
const P = slug => real.getProduct(slug);
const view = (p, s) => describeSelection(p, s, { whatsappNumber: NUMBER });
const planNamed = (p, name) => p.plans.find(x => x.name === name);
const offerOf = (p, planName, label) => planNamed(p, planName).offers.find(o => o.durationLabel === label);

function pick(p, planName, durationLabel) {
  let s = choosePlan(p, initialSelection(p), planNamed(p, planName).id);
  if (durationLabel) s = chooseOffer(p, s, offerOf(p, planName, durationLabel).id);
  return s;
}

test('paket dan durasi belum dipilih saat detail produk dibuka (FR04)', () => {
  const s = initialSelection(P('netflix'));
  assert.equal(s.planId, null);
  assert.equal(s.offerId, null);
  const v = view(P('netflix'), s);
  assert.equal(v.step, 'plan');
  assert.equal(v.canOrder, false);
  assert.equal(v.draft, null);
  assert.match(v.hint, /paket/i);
});

test('setelah memilih paket, pembeli diminta memilih durasi dan belum bisa memesan (FR04, FR06)', () => {
  const v = view(P('netflix'), pick(P('netflix'), '1P1U'));
  assert.equal(v.step, 'duration');
  assert.equal(v.canOrder, false);
  assert.equal(v.draft, null);
  assert.match(v.hint, /durasi/i);
});

test('UAT01: Netflix → 1P1U → 1 bulan menghasilkan Rp40.000 dan draf yang menyebut ketiga pilihan', () => {
  const v = view(P('netflix'), pick(P('netflix'), '1P1U', '1 bulan'));
  assert.equal(v.step, 'complete');
  assert.equal(v.priceText, 'Rp40.000');
  assert.equal(v.canOrder, true);
  assert.equal(v.hint, null);
  assert.equal(v.draft.kind, 'order');
  assert.equal(v.draft.message, PRD_MESSAGE);
  assert.equal(v.draft.href, PRD_URL);
});

test('UAT02: ganti paket mempertahankan durasi yang tersedia lalu memperbarui harga dan draf', () => {
  const netflix = P('netflix');
  const s = choosePlan(netflix, pick(netflix, '1P1U', '1 bulan'), planNamed(netflix, '1P2U').id);
  assert.equal(s.durationCleared, false);
  const v = view(netflix, s);
  assert.equal(v.offer.id, offerOf(netflix, '1P2U', '1 bulan').id);
  assert.equal(v.priceText, 'Rp30.000');
  assert.equal(v.draft.message, 'Halo, saya tertarik membeli Netflix paket 1P2U untuk durasi 1 bulan. Harga yang tertera Rp30.000. Apakah tersedia?');
});

test('UAT02: durasi yang tidak ada di paket baru tidak terbawa (FR05)', () => {
  const netflix = P('netflix');
  const s = choosePlan(netflix, pick(netflix, '1P1U', '14 hari'), planNamed(netflix, '1P2U').id);
  assert.equal(s.offerId, null);
  assert.equal(s.durationCleared, true);
  const v = view(netflix, s);
  assert.equal(v.canOrder, false);
  assert.equal(v.draft, null);
  assert.match(v.hint, /durasi/i);
});

test('ganti ke paket yang hanya punya satu durasi memilih durasi itu otomatis', () => {
  const netflix = P('netflix');
  const s = choosePlan(netflix, pick(netflix, '1P1U', '3 hari'), planNamed(netflix, 'Semi Private').id);
  assert.equal(s.autoOffer, true);
  assert.equal(view(netflix, s).priceText, 'Rp55.000');
});

test('produk dengan satu paket dan satu durasi langsung terpilih dengan penanda otomatis (FR04)', () => {
  const s = initialSelection(P('goodnotes'));
  assert.equal(s.autoPlan, true);
  assert.equal(s.autoOffer, true);
  const v = view(P('goodnotes'), s);
  assert.equal(v.canOrder, true);
  assert.equal(v.draft.message, 'Halo, saya tertarik membeli Goodnotes untuk durasi 1 tahun. Harga yang tertera Rp40.000. Apakah tersedia?');
});

test('Dazzcam iOS: draf menyebut Lifetime, masa garansi 6 bulan tampil terpisah (FR08)', () => {
  const v = view(P('dazzcam-ios'), initialSelection(P('dazzcam-ios')));
  assert.equal(v.offer.durationLabel, 'Lifetime');
  assert.equal(v.warrantyText, '6 bulan');
  assert.equal(v.draft.message, 'Halo, saya tertarik membeli Dazzcam iOS paket Lifetime untuk durasi Lifetime. Harga yang tertera Rp30.000. Apakah tersedia?');
  assert.doesNotMatch(v.draft.message, /6 bulan/);
});

test('contoh PRD: ChatGPT Plus Sharing 5u dan Canva Invite member menampilkan harga sesuai durasi', () => {
  const gpt = P('chatgpt-plus');
  assert.equal(view(gpt, pick(gpt, 'Sharing 5u', '7 hari')).priceText, 'Rp30.000');
  assert.equal(view(gpt, pick(gpt, 'Sharing 5u', '1 bulan')).priceText, 'Rp55.000');
  const canva = P('canva');
  const month = view(canva, pick(canva, 'Invite member', '1 bulan'));
  assert.equal(month.priceText, 'Rp12.000');
  assert.equal(view(canva, pick(canva, 'Invite member', '1 tahun')).priceText, 'Rp32.000');
  assert.equal(month.notes.length, 1);
  // The unconfirmed designer add-on must not leak into the order draft or its total.
  assert.equal(month.draft.message, 'Halo, saya tertarik membeli Canva paket Invite member untuk durasi 1 bulan. Harga yang tertera Rp12.000. Apakah tersedia?');
});

test('penawaran yang perlu konfirmasi tidak bisa dipesan dan menawarkan draf tanya harga (UAT05)', () => {
  const cases = [['netflix', 'Private', '1 bulan', 'Netflix'], ['wps-office', 'Private', '1 bulan', 'WPS Office'], ['crunchyroll', 'Private', '7 hari', 'Crunchyroll']];
  for (const [slug, pl, dur, name] of cases) {
    const v = view(P(slug), pick(P(slug), pl, dur));
    assert.equal(v.priceText, 'Hubungi admin', slug);
    assert.equal(v.canOrder, false, slug);
    assert.equal(v.draft.kind, 'price', slug);
    assert.equal(v.draft.message, `Halo, saya ingin menanyakan paket, durasi, dan harga untuk ${name}.`, slug);
    assert.match(v.hint, /konfirmasi|harga/i, slug);
    assert.doesNotMatch(JSON.stringify(v), /Rp0\b/, slug);
  }
});

test('produk tanpa rincian langsung menawarkan draf tanya paket dan harga', () => {
  const v = view(P('lightroom'), initialSelection(P('lightroom')));
  assert.equal(v.step, 'none');
  assert.equal(v.canOrder, false);
  assert.equal(v.draft.kind, 'price');
  assert.equal(v.draft.message, 'Halo, saya ingin menanyakan paket, durasi, dan harga untuk Lightroom.');
});

const fixture = (productStatus = 'active', availability = 'available') => prepareCatalog(catalog([
  product('alpha', 'streaming', [plan('alpha', 'Sharing', [[1, 'month', 15000, availability], [3, 'month', 30000]])], productStatus),
])).getProduct('alpha');

test('stok habis tidak bisa dipesan; draf hanya bertanya ketersediaan (FR07)', () => {
  const p = fixture('active', 'sold_out');
  const s = chooseOffer(p, choosePlan(p, initialSelection(p), p.plans[0].id), p.plans[0].offers[0].id);
  const v = view(p, s);
  assert.equal(v.canOrder, false);
  assert.equal(v.draft.kind, 'stock');
  assert.equal(v.draft.message, 'Halo, apakah Alpha paket Sharing untuk 1 bulan sudah tersedia kembali?');
  assert.match(v.statusLabel, /habis/i);
});

test('produk nonaktif tidak bisa dipesan meski harganya valid (FR07)', () => {
  const p = fixture('inactive');
  const s = chooseOffer(p, choosePlan(p, initialSelection(p), p.plans[0].id), p.plans[0].offers[1].id);
  const v = view(p, s);
  assert.equal(v.canOrder, false);
  assert.equal(v.draft.kind, 'stock');
});

test('pilihan tersimpan dipulihkan bila masih cocok dan dibuang bila tidak', () => {
  const netflix = P('netflix');
  const p1 = planNamed(netflix, '1P1U');
  const ok = offerOf(netflix, '1P1U', '1 bulan');
  const kept = initialSelection(netflix, { planId: p1.id, offerId: ok.id });
  assert.deepEqual([kept.planId, kept.offerId, kept.discarded], [p1.id, ok.id, false]);

  const foreign = offerOf(netflix, '1P2U', '1 bulan');
  const mixed = initialSelection(netflix, { planId: p1.id, offerId: foreign.id });
  assert.deepEqual([mixed.planId, mixed.offerId, mixed.discarded], [p1.id, null, true]);

  const unknown = initialSelection(netflix, { planId: 'tidak-ada', offerId: ok.id });
  assert.deepEqual([unknown.planId, unknown.offerId, unknown.discarded], [null, null, true]);
});

test('durasi dari paket lain dan id paket tak dikenal diabaikan', () => {
  const netflix = P('netflix');
  const s = pick(netflix, '1P1U');
  assert.equal(chooseOffer(netflix, s, offerOf(netflix, '1P2U', '1 bulan').id).offerId, null);
  assert.equal(choosePlan(netflix, s, 'tidak-ada').planId, s.planId);
});
