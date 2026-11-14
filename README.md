# PACELAB (v1.4.0-offline)

## Status per fase
- **Fase 1** Scaffold Vite + React + TS, skema Dexie (`workouts`, `userProfile`), ekspor/impor JSON, layar profil. Tailwind belum dipasang.
- **Fase 2** Impor GPX (DOMParser, moving time, lap per km, HR, elevasi) dan input manual dengan validasi durasi serta RPE. **Parser FIT belum dibangun** (perlu `fit-file-parser`, belum diuji).
- **Fase 3** Engine analitik: Tanaka, Banister TRIMP, Session-RPE, EF + tren 14 hari, ACWR, Riegel + penalti volume dan long run. Ada tes unit. **VDOT belum diimplementasi** (tidak ada rumus di blueprint).
- **Fase 4** Konfigurasi PWA (`vite-plugin-pwa`, `manifest.json`, `base` GitHub Pages). **Belum ada**: lima tab penuh, grafik Recharts, styling mengikuti mockup, ikon PWA (`public/icons/`).

## Perbaikan terhadap blueprint
1. **ACWR**: baseline kronis = total 28 hari ÷ 4. Membagi total dengan 1 menghasilkan rasio ~0,25 untuk beban konstan.
2. **Penalti**: blueprint menyebut ambang 10K, tetapi teks penalti hanya untuk 21,1K dan 42,2K. 10K tidak dikenai penalti.
3. **Konstanta penalti** (12% volume, 8% long run) dan ambang long run 21,1K (18 km) tidak ada di blueprint. Keduanya ada di `predictor.ts` dan bisa disetel. Angka "+20 menit" di mockup tidak bisa direproduksi dari rumus dokumen.
4. **Durasi**: "JJ:MM:DD" diganti HH:MM:SS (MM:SS untuk target singkat).
5. **Basis Riegel**: "sesi performa terbaik 42 hari" diartikan sebagai sesi ≥ 5 km dengan proyeksi tercepat.
6. **Cadence GPX** dikali 2 (spm) karena banyak perangkat mencatat per kaki.

## Menjalankan
```
npm install
npm test        # butuh Node ≥ 22.6 (--experimental-strip-types)
npm run dev
npm run build
```
Untuk GitHub Pages, sesuaikan `base` di `vite.config.ts` dengan nama repositori.

## v1.5.0 — Rencana 8 Minggu Nike Run Club 5K
- Data: `src/plans/nike5k.ts` (8 minggu + Hari-H). Urutan sesi mengikuti urutan teks PDF; PDF tidak mencantumkan nama hari.
- Pace: `src/plans/pace.ts` mencari baris Pace Chart terdekat dari 5K terbaru Anda, lalu mengisi target per langkah.
  Mile Pace = kolom mile best; Recovery & Long Run = recovery pace; Race Day = 5K avg mile pace; Best Pace = sesuai effort (tanpa angka).
- Kolom half marathon dan marathon tidak dipakai.
- Temuan di PDF: Minggu 1 (Tempo) langkahnya berjumlah 20:00, tetapi judulnya 15:00. Teks PDF menyebut dua recovery run per minggu, tetapi Minggu 1 memiliki tiga.
- Input 5K tidak disimpan; diisi ulang setiap buka layar.
