# Katalog Aplikasi

**Situs live: https://katalog-apps.pages.dev**

Web katalog paket aplikasi (streaming, education, editing, music, other) dengan pemesanan lewat WhatsApp. Pembeli memilih **produk → paket → durasi**. Website lalu menampilkan harga, ketentuan, ringkasan, dan menyiapkan draf chat ke admin di **+62 857-2459-0854**. Pesan baru terkirim setelah pembeli menekan Kirim di WhatsApp.

Dibangun sesuai *PRD Web Katalog Aplikasi v1.0* dengan data dari *PRICELIST APPS* (pembaruan sumber 27 Juni 2026). Situs ini statis (HTML, CSS, dan JavaScript tanpa framework), jadi bisa di-host gratis tanpa server dan tanpa proses build.

## Fitur

- Katalog 50 aplikasi dalam 5 kategori, lengkap dengan logo resmi dan harga mulai.
- Pencarian yang tidak membedakan huruf besar-kecil, bisa digabung dengan filter kategori. Hasil kosong menampilkan tombol reset. Kata kunci dan kategori tersimpan di URL.
- Halaman detail per produk (`/produk?p=netflix`, bisa dibagikan): pilih paket lalu durasi. Durasi yang tidak tersedia di paket baru otomatis dihapus, dan harga, ringkasan, serta draf selalu memakai penawaran yang sama.
- Tombol **“Pesan lewat WhatsApp”** aktif hanya bila pilihan lengkap, harga valid, dan status tersedia. Jika belum, tombol menunjukkan pilihan yang masih kurang.
- Harga kosong atau ambigu tampil sebagai **“Hubungi admin”** (tidak pernah Rp0) dengan tombol tanya harga. Stok habis dan produk nonaktif hanya menawarkan **“Tanya ketersediaan”**.
- Lifetime dan masa garansi ditampilkan terpisah dari durasi layanan.
- Tombol Salin pesan dan Salin nomor, dengan cadangan salin manual bila browser menolak.
- Pilihan paket tersimpan selama sesi browser.
- Cara beli, ketentuan layanan, FAQ yang bisa dibuka-tutup dengan klik atau keyboard, dan bar pesan di bawah layar ponsel.
- Aksesibel: kontras teks minimal 4,5:1, fokus keyboard terlihat, target sentuh minimal 44 px, dan pengumuman untuk pembaca layar.

## Struktur

```
site/                   ← folder yang di-deploy
  index.html            beranda: katalog, cara beli, ketentuan, FAQ
  produk.html           detail produk (diakses sebagai /produk?p=<slug>)
  404.html, _headers    halaman 404 & header keamanan (Cloudflare Pages)
  data/catalog.json     DATA PRODUK, PAKET, DURASI, HARGA
  assets/js/store.js    nama toko & nomor WhatsApp (satu tempat untuk semua tombol)
  assets/js/lib/        logika (format harga, draf WhatsApp, katalog, pilihan paket)
  assets/logos/         logo aplikasi (WebP 160 px), sumber di docs/sumber-logo.md
scripts/                server pratinjau & validasi katalog
tests/                  tes otomatis (node:test), termasuk cek data terhadap pricelist
```

## Menjalankan di komputer

Butuh [Node.js](https://nodejs.org) 20 atau lebih baru. Tidak ada dependensi yang perlu dipasang.

```bash
npm run serve      # pratinjau di http://localhost:4173
npm test           # jalankan semua tes
npm run validate   # periksa catalog.json sebelum diterbitkan
```

## Memperbarui harga dan produk

Semua data ada di `site/data/catalog.json`. Strukturnya Produk → `plans` (paket) → `offers` (durasi + harga).

| Field penawaran | Isi |
|---|---|
| `durationValue`, `durationUnit` | angka + `day` / `month` / `year`, atau `null` + `lifetime` |
| `durationLabel` | teks tampilan, mis. `1 bulan`, `Lifetime` |
| `priceIdr` | harga dalam rupiah tanpa titik (mis. `40000`), atau `null` bila belum ada |
| `availability` | `available` (dapat dipesan), `sold_out` (stok habis), `needs_confirmation` (harga perlu konfirmasi), `inactive` |

Produk atau paket bisa dinonaktifkan dengan `"status": "inactive"`. Masa garansi diisi di `warrantyPeriod` pada paket. Aturan pemakaian, jenis akses, dan cara aktivasi diisi di `usageRules`, `accessType`, dan `activationNotes`. Selama masih `null`, halaman menampilkan “Hubungi admin”.

Setelah mengubah data, jalankan `npm run validate`. Skrip ini menolak harga nol, durasi ganda, kategori salah, dan logo yang filenya tidak ada. Perbarui juga `meta.catalogUpdatedAt`.

**Nomor WhatsApp atau nama toko** diubah di `site/assets/js/store.js`. Teks cadangan (dipakai bila JavaScript mati) ada di `index.html`, `produk.html`, dan `404.html`.

## Hosting gratis (Cloudflare Pages)

Situs di-host di [Cloudflare Pages](https://pages.cloudflare.com) paket gratis: bandwidth tanpa batas, HTTPS otomatis, boleh untuk usaha, dan memakai subdomain gratis `*.pages.dev`. GitHub Pages sengaja tidak dipakai karena ketentuannya melarang situs bisnis atau e-commerce.

```bash
npx wrangler@4 login --scopes account:read user:read pages:write   # sekali saja, izin minimal
npm run deploy                                                      # tes + validasi, lalu unggah folder site/
```

Proyek Pages `katalog-apps` sudah dibuat, jadi setiap ada perubahan cukup jalankan `npm run deploy` lagi. Jika wrangler menawarkan memindahkan proyek ke Workers, atau mengubah `package.json` dan membuat `wrangler.jsonc`, tolak tawaran itu atau pulihkan file dengan `git checkout -- package.json`. Situs ini memakai Pages tanpa dependensi.

## Perlu dikonfirmasi sebelum tayang

- **Harga** berasal dari pricelist 27 Juni 2026. Pastikan semuanya masih berlaku.
- **Netflix Private**: harga bergantung domain. **WPS Office Private 1 bulan**: dua harga tanpa pembeda. **Crunchyroll Private 7 hari**: harga tidak tercantum. Ketiganya ditandai “perlu konfirmasi”.
- **Tambahan AI (WPS)** dan **designer (Canva)**: tarif dan cakupannya belum jelas, jadi tidak ditampilkan sebagai harga.
- **Viki Private 7 hari** dan **Claude AI Sharing 7 hari** tidak menyebut varian (std/plus atau 3u/5u). Keduanya ditampilkan sebagai paket “Private” atau “Sharing” tersendiri.
- 11 produk belum punya rincian paket dan harga (Lightroom, Meitu, Oldroll Android, Wink, Polarr, Prequel, Photoroom, Picwish, Procreate, Apple Music, Wattpad).
- Deskripsi singkat tiap aplikasi masih bersifat umum dan perlu disetujui pengelola.
- **Nama toko, logo toko, domain, metode pembayaran, jam layanan, kebijakan refund, dan prosedur garansi** belum ditetapkan. Sementara ini tampil “Hubungi admin” dan nama kerja “Katalog Aplikasi”.
- Tanda ✅ di pricelist (Goodnotes, Grammarly, Scribd) tidak dijelaskan, jadi tidak ditampilkan.
- Logo Loklok dan Drakor ID belum dipasang (lihat `docs/sumber-logo.md`).

## Catatan

- Palet warna mengacu pada gambar referensi “ikan emas” (#F4EF5A, #B0D763, #B1EBF7, #87D5EB, #FFD240). Gambar referensinya sendiri tidak disertakan di repo karena hak ciptanya milik pembuatnya.
- Nama dan logo aplikasi adalah merek dagang milik pemiliknya masing-masing. Katalog ini tidak berafiliasi dengan pemilik aplikasi tersebut.
