// Checks site/data/catalog.json against the PRD and the PRICELIST snapshot.
// Catches: invented/typo'd prices, missing products, ambiguous data shown as orderable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, prepareCatalog } from '../site/assets/js/lib/catalog.js';
import { loadRealCatalog, loadPricelistSnapshot } from './helpers.js';

const raw = loadRealCatalog();
const real = prepareCatalog(raw);
const byName = name => raw.products.find(p => p.name === name);
const planOf = (productName, planName) => byName(productName).plans.find(pl => pl.name === planName);
const priceMap = pl => Object.fromEntries(pl.offers.map(o => [o.durationLabel, o.priceIdr]));

test('catalog.json lolos validasi tanpa error', () => {
  const { errors } = validateCatalog(raw);
  assert.deepEqual(errors, []);
});

test('daftar produk dan kategori sama dengan "Daftar produk awal" PRD', () => {
  const PRD = {
    streaming: ['Netflix', 'Disney', 'iQIYI', 'Viu', 'WeTV', 'Prime', 'YouTube', 'HBO', 'Loklok', 'Crunchyroll', 'Bstation', 'Gagaolala', 'Mango TV', 'Viki', 'Drakor ID', 'Youku'],
    education: ['ChatGPT Go', 'ChatGPT Plus', 'Perplexity AI', 'Gemini AI', 'Claude AI', 'Grok AI', 'Blackbox AI', 'Microsoft 365', 'Goodnotes', 'Quillbot', 'Grammarly', 'Scribd', 'WPS Office', 'Duolingo Super'],
    editing: ['Canva', 'CapCut', 'Remini', 'Picsart', 'Alight Motion', 'CamScanner', 'Dazzcam iOS', 'Beauty Plus', 'Ibis Paint', 'Lightroom', 'Meitu', 'Oldroll Android', 'Wink', 'Polarr', 'Prequel', 'Photoroom', 'Picwish', 'Procreate'],
    music: ['Apple Music'],
    other: ['Wattpad'],
  };
  for (const [cat, list] of Object.entries(PRD)) {
    assert.deepEqual(raw.products.filter(p => p.category === cat).map(p => p.name), list, cat);
  }
  assert.deepEqual(raw.categories.map(c => c.name), ['Streaming', 'Education', 'Editing', 'Music', 'Other']);
});

test('contoh pilihan PRD tersedia dengan harga yang tepat', () => {
  const netflix = priceMap(planOf('Netflix', '1P1U'));
  assert.equal(netflix['1 hari'], 6000);
  assert.equal(netflix['1 bulan'], 40000);
  assert.equal(netflix['3 bulan'], 120000);
  assert.deepEqual(priceMap(planOf('ChatGPT Plus', 'Sharing 5u')), { '1 hari': 15000, '3 hari': 20000, '7 hari': 30000, '1 bulan': 55000 });
  const canva = priceMap(planOf('Canva', 'Invite member'));
  assert.equal(canva['1 bulan'], 12000);
  assert.equal(canva['1 tahun'], 32000);
  const dazz = planOf('Dazzcam iOS', 'Lifetime');
  assert.deepEqual(dazz.offers.map(o => [o.durationUnit, o.durationLabel, o.priceIdr]), [['lifetime', 'Lifetime', 30000]]);
  assert.equal(dazz.warrantyPeriod.label, '6 bulan');
});

test('data yang perlu dikonfirmasi tidak bisa dipesan dan tidak punya harga (PRD: jangan mengarang harga)', () => {
  const pending = [
    ['Netflix', 'Private', '1 bulan'],
    ['Crunchyroll', 'Private', '7 hari'],
    ['WPS Office', 'Private', '1 bulan'],
  ];
  for (const [prod, pl, dur] of pending) {
    const o = planOf(prod, pl).offers.find(x => x.durationLabel === dur);
    assert.equal(o.priceIdr, null, `${prod} ${pl}`);
    assert.equal(o.availability, 'needs_confirmation', `${prod} ${pl}`);
    const prepared = real.getProduct(byName(prod).slug).plans.find(x => x.name === pl).offers.find(x => x.durationLabel === dur);
    assert.equal(prepared.orderable, false, `${prod} ${pl}`);
  }
});

test('produk tanpa rincian di pricelist tidak punya paket atau harga', () => {
  const noDetails = ['Lightroom', 'Meitu', 'Oldroll Android', 'Wink', 'Polarr', 'Prequel', 'Photoroom', 'Picwish', 'Procreate', 'Apple Music', 'Wattpad'];
  assert.deepEqual(raw.products.filter(p => p.plans.length === 0).map(p => p.name), noDetails);
  for (const name of noDetails) assert.equal(real.getProduct(byName(name).slug).startingPrice, null, name);
});

test('tarif tambahan yang belum dikonfirmasi (AI WPS, designer Canva) tidak ditampilkan sebagai harga', () => {
  const notes = raw.products.flatMap(p => p.plans.flatMap(pl => pl.notes));
  assert.equal(notes.length, 2);
  for (const n of notes) assert.doesNotMatch(n, /\d/, n);
});

test('harga mulai di kartu memakai penawaran valid termurah', () => {
  const cases = { netflix: 6000, canva: 3000, crunchyroll: 20000, 'wps-office': 20000, 'dazzcam-ios': 30000, lightroom: null };
  for (const [slug, want] of Object.entries(cases)) assert.equal(real.getProduct(slug).startingPrice, want, slug);
});

// ---- Fidelity against the pricelist snapshot (independent parser) ----
const UNIT_WORD = { day: 'hari', month: 'bulan', year: 'tahun' };
const rows = loadPricelistSnapshot().split(/\r?\n/)
  .filter(l => l.startsWith('| ') && !l.startsWith('| Aplikasi'))
  .map(l => l.split('|').slice(1, -1).map(s => s.trim()));
const segmentsOf = text => text.split(/\.\s*Catatan:/)[0].split(';').map(s => s.trim()).filter(Boolean);

test('setiap harga di katalog berasal dari baris pricelist yang sama, tanpa harga karangan', () => {
  for (const p of raw.products) {
    for (const pl of p.plans) {
      const row = rows.filter(r => r[0] === p.source.name && r[1] === pl.source.name);
      assert.equal(row.length, 1, `${p.name} / ${pl.source.name}`);
      const segs = segmentsOf(row[0][2]);
      for (const o of pl.offers) {
        for (const part of o.source.split('; ')) assert.ok(segs.includes(part), `${o.id}: "${part}" tidak ada di pricelist`);
        if (o.availability !== 'available') { assert.equal(o.priceIdr, null, o.id); continue; }
        const m = /^(?:(\d+) (hari|bulan|tahun)|Garansi \d+ \w+) ([\d.]+)(?: \((\w+)\))?$/.exec(o.source);
        assert.ok(m, `${o.id}: format sumber tidak dikenal "${o.source}"`);
        assert.equal(o.priceIdr, Number(m[3].replace(/\./g, '')), o.id);
        assert.equal(pl.source.variant, m[4] ?? null, o.id);
        if (o.durationUnit === 'lifetime') assert.equal(pl.source.name, 'Lifetime', o.id);
        else assert.equal(`${o.durationValue} ${UNIT_WORD[o.durationUnit]}`, `${m[1]} ${m[2]}`, o.id);
      }
    }
  }
});

test('setiap durasi dan harga di pricelist terwakili di katalog', () => {
  const fromSource = rows.filter(r => r[2] !== 'Tanpa rincian paket atau harga')
    .flatMap(r => segmentsOf(r[2]).map(s => `${r[0]} | ${r[1]} | ${s}`)).sort();
  const fromCatalog = raw.products.flatMap(p => p.plans.flatMap(pl => pl.offers.flatMap(o =>
    o.source.split('; ').map(s => `${p.source.name} | ${pl.source.name} | ${s}`)))).sort();
  assert.deepEqual(fromCatalog, fromSource);
});
