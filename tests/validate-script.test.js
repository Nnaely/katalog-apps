import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog, product, plan } from './helpers.js';

const script = fileURLToPath(new URL('../scripts/validate-catalog.mjs', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

test('npm run validate lolos (kode keluar 0) untuk catalog.json saat ini', () => {
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /50 produk/);
});

test('validate gagal (kode keluar 1) dan menyebut id penawaran yang bermasalah', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'katalog-'));
  const file = path.join(dir, 'catalog.json');
  const bad = catalog([product('alpha', 'streaming', [plan('alpha', 'Sharing', [[1, 'month', 0]])])]);
  fs.writeFileSync(file, JSON.stringify(bad));
  const result = run(file);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /alpha-sharing-1-bulan/);
});

test('validate gagal bila logo produk menunjuk ke file yang tidak ada', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'katalog-'));
  fs.mkdirSync(path.join(dir, 'data'));
  const file = path.join(dir, 'data', 'catalog.json');
  const c = catalog([product('alpha', 'streaming', [plan('alpha', 'Sharing', [[1, 'month', 15000]])])]);
  c.products[0].image = 'assets/logos/alpha.webp';
  fs.writeFileSync(file, JSON.stringify(c));
  const result = run(file);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /alpha.*assets\/logos\/alpha\.webp/);
});

test('validate gagal dengan pesan jelas bila file bukan JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'katalog-'));
  const file = path.join(dir, 'catalog.json');
  fs.writeFileSync(file, '{ "products": [ ');
  const result = run(file);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /JSON/);
});
