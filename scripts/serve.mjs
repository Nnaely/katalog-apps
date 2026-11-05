#!/usr/bin/env node
// Server statis sederhana untuk pratinjau lokal: npm run serve  ->  http://localhost:4173
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../site/', import.meta.url));
const port = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    let file = path.normalize(path.join(root, decodeURIComponent(pathname)));
    if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    // Like Cloudflare Pages: "/produk" serves "produk.html".
    else if (!path.extname(file)) file += '.html';
    const body = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    const notFound = await fs.readFile(path.join(root, '404.html')).catch(() => 'Tidak ditemukan');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(notFound);
  }
}).listen(port, () => console.log(`Pratinjau: http://localhost:${port}`));
