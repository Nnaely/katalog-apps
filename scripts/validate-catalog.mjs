#!/usr/bin/env node
// Validasi data katalog sebelum diterbitkan.
// Pemakaian: npm run validate            (memeriksa site/data/catalog.json)
//            node scripts/validate-catalog.mjs path/ke/catalog.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog, isSafeImagePath } from '../site/assets/js/lib/catalog.js';

const file = process.argv[2] ?? fileURLToPath(new URL('../site/data/catalog.json', import.meta.url));

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`✖ Tidak bisa membaca ${file} sebagai JSON: ${error.message}`);
  process.exit(1);
}

const { errors, warnings } = validateCatalog(data);
const products = Array.isArray(data?.products) ? data.products : [];
// Logo files are resolved from the site root (the folder that contains data/catalog.json).
const siteRoot = path.resolve(path.dirname(file), '..');
for (const p of products) {
  if (isSafeImagePath(p?.image) && !fs.existsSync(path.join(siteRoot, p.image))) {
    errors.push(`Gambar produk ${p.id} tidak ditemukan: ${p.image}`);
  }
}
const offers = products.flatMap(p => (p.plans ?? []).flatMap(pl => pl.offers ?? []));
const count = status => offers.filter(o => o.availability === status).length;

console.log(`Katalog: ${products.length} produk, ${offers.length} penawaran (${count('available')} dapat dipesan, ${count('needs_confirmation')} perlu konfirmasi, ${count('sold_out')} habis, ${count('inactive')} nonaktif).`);
for (const w of warnings) console.log(`⚠ ${w}`);
for (const e of errors) console.log(`✖ ${e}`);

if (errors.length) {
  console.log(`\n${errors.length} error. Perbaiki sebelum diterbitkan.`);
  process.exit(1);
}
console.log('✔ Data katalog valid.');
