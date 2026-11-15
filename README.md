# PACELAB (v1.4.0-offline)

## Status per fase
- **Fase 1** Scaffold Vite + React + TS, skema Dexie (`workouts`, `userProfile`), ekspor/impor JSON, layar profil. Tailwind belum dipasang.
- **Fase 2** Impor GPX (DOMParser, moving time, lap per km, HR, elevasi) dan input manual dengan validasi durasi serta RPE. **Parser FIT** sudah ada (`fitParser.ts`, decoder biner mandiri tanpa dependensi). Fase 2 selesai.
- **Fase 3** Engine analitik: Tanaka, Banister TRIMP, Session-RPE, EF + tren 14 hari, ACWR, Riegel + penalti volume dan long run. Ada tes unit. **VDOT** ada sejak v1.7 (rumus Daniels).
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

## v1.6.0 — Fase 2 selesai (Parser FIT)
- `src/parsers/fitParser.ts`: membaca header, definisi/data pesan, header timestamp terkompresi, dan field developer (dilewati). Mengambil session (jarak, durasi, HR, elevasi) dan split per km dari record.
- Tes memakai berkas FIT sintetis. Belum diuji dengan berkas Garmin/Coros asli.
- Asumsi: cadence dikali 2 (sama dengan GPX); bila ada beberapa session, yang dipakai session pertama; CRC berkas belum divalidasi.

## v1.7.0 — Fase 3 selesai
- `workload.ts`: `cardiacDrift(laps)` = penurunan EF paruh pertama ke paruh kedua lap (aerobic decoupling). Butuh minimal 4 lap dengan HR.
- `predictor.ts`: `vdot()` (Daniels), `velocityFor()` untuk zona pace (titik tengah %VO2max: 66,5 / 79,5 / 85,5 / 97,5), `currentVdot()` dari sesi ≥ 3 km dalam 42 hari.
- `coachEngine.ts`: aturan blueprint 4.1 (catatan EF) dan 4.2 (ACWR → sesi berikutnya). Murni logika, tanpa dependensi UI.
- Asumsi yang perlu ditinjau: ambang drift 5%, durasi tambahan +10 menit untuk beban rendah, dan titik tengah zona Daniels.
- Fase 4 (grafik Recharts, lima tab, UI backup, ikon PWA) belum dikerjakan.

## v1.9.0 — Fase 4 tuntas
- `.github/workflows/deploy.yml`: build dan deploy otomatis ke GitHub Pages pada push ke `main`. Di pengaturan repositori, pilih Settings → Pages → Source: GitHub Actions. Commit `package-lock.json` agar `npm ci` dipakai; tanpa lockfile, workflow memakai `npm install`.
- Tes tidak dijalankan di workflow karena butuh Node 22+ (`--experimental-strip-types`), sedangkan workflow memakai Node 20.
- `UserProfile.weeklyTargetKm` dan `Workout.note` bersifat opsional, sehingga data lama tetap kompatibel.
- Filter kategori jarak memakai jarak lomba terdekat dengan selisih ≤ 10%. Sesi di luar itu hanya tampil di "Semua jarak".
- Riwayat: pencarian dibatasi pada catatan dan jenis sesi, karena sesi tidak punya judul.

## v2.0.0 — penyempurnaan
Perbaikan bug dari v1.9:
- Max HR manual tidak lagi tertimpa Tanaka saat profil disimpan ulang (checkbox otomatis hanya aktif bila nilai tersimpan memang hasil Tanaka).
- Impor FIT/GPX tanpa HR kini meminta RPE; sebelumnya beban (TRIMP) tercatat 0 tanpa peringatan.
- Impor memilih jenis sesi (sebelumnya selalu Easy, yang mencemari tren EF); jenis dan catatan bisa diubah di detail sesi.
- Impor berkas yang sama (atau FIT dan GPX dari lari yang sama) dilewati: waktu mulai ≤ 2 menit dan jarak ≤ 0,1 km.
- Input berkas direset setelah dipakai sehingga berkas yang sama bisa dipilih ulang.
- Sesi manual punya tanggal (tidak lagi selalu hari ini).
- Warna tema status bar disamakan dengan latar aplikasi; layar kembali ke atas saat pindah tab.

Tambahan:
- Jarum ACWR (gauge) dan pita zona 0,8–1,3 pada grafik ACWR.
- Filter jenis sesi di Riwayat; tombol "Hapus semua data lokal" di Profil.
- Impor cadangan divalidasi (`src/db/validate.ts`): sesi rusak dilewati dan dilaporkan; profil lama dipertahankan bila cadangan tidak memuat profil valid.
- Input 5K di Program tersimpan di localStorage (tidak ikut cadangan JSON) dan terisi awal dari prediksi Riegel.
- Ikon stopwatch baru, termasuk varian maskable.
- Workflow menjalankan tes (Node 22) sebelum build (Node 20). Hapus job `test` dan `needs: test` bila tidak diinginkan.
- `src/analytics`, `src/parsers`, dan `src/plans` tidak diubah dari v1.9.

## v2.1.0 — Pelatih Pemecah PB Adaptif dengan Jadwal Tanggal Nyata
Label statis "8 minggu lagi" dihapus. Tab **Program** kini memetakan rencana mundur dari `targetRaceDate`.

**Kalender mundur** (`src/plans/schedule.ts`)
- `daysRemaining = ceil((tanggal lomba − hari ini) / 86400000)`, `weeksRemaining = ceil(daysRemaining / 7)`, dihitung pada tanggal kalender (aman DST).
- `weeksRemaining > 8`: minggu awal = **Base Building** (Easy Run + Long Run, target volume naik maks +10%/minggu, berhenti di batas `weeklyTargetKm` profil → syarat volume 21,1K/42,2K → 50 km), lalu blok puncak 8 minggu (templat Nike).
- `weeksRemaining ≤ 8`: memakai N minggu **terakhir** templat Nike; sesi terakhir = **Hari Lomba / Uji PB** tepat di `targetRaceDate`; minggu terakhir = **Taper** (volume −35%, langkah pace speed dipertahankan).
- Minggu rencana adalah blok 7 hari yang dihitung mundur dari hari lomba (bukan Senin–Minggu).
- Tanggal lomba bisa diubah di atas tab Program (tersimpan ke profil, sinkron dengan Profil).

**Hari latihan & Adjust Jadwal**
- Pilih hari rutin (default Sel/Kam/Sab/Min, minimal 3). Long Run jatuh di Sab/Min pilihan; Speed tidak pernah bersebelahan dengan Long Run (termasuk lintas minggu). Bila hari terpilih tidak memungkinkan, Speed diturunkan jadi Easy Run dan ditandai. Bila hari lebih sedikit daripada sesi, Recovery dibuang lebih dulu.
- Geser semua ±1 hari, Reset, ubah tanggal per sesi, tukar sesi (dalam minggu yang sama). Hari lomba tidak ikut bergeser; sesi lain tidak bisa jatuh pada/setelah hari lomba.
- Disimpan di `localStorage` (`pacelab.schedule`) dan ikut diekspor/diimpor di cadangan JSON (field `schedule`, cadangan lama tanpa field itu tetap bisa diimpor).
- Auto-Complete: sesi berstatus Selesai bila ada catatan latihan pada tanggal itu (≤ hari ini); bisa juga dicentang manual.

**Mesin adaptif** (`src/plans/adaptiveEngine.ts`)
- Progresi pace: `weekPace = currentPace − (currentPace − targetPace) × (minggu / totalMinggu)`; `currentPace` = proyeksi Riegel. Kartu atas Program menampilkan gap waktu, label peluang, dan perbaikan per minggu yang dibutuhkan.
- Aturan setelah sesi terakhir (dievaluasi ulang setiap render, jadi hilang/berubah saat data baru masuk): ACWR > 1,3 → Speed berikutnya jadi Recovery Easy Run, −20% durasi; EF terakhir ≥ rata-rata EF 14 hari +3% → pace Speed berikutnya −4 dtk/km; drift > 5% → pace Easy berikutnya +12 dtk/km; ACWR < 0,8 dan drift ≤ 5% → Easy/Long berikutnya +10% (maks +10 menit).

**Keputusan/asumsi yang perlu ditinjau**
- "Sesi berikutnya" = sesi pertama dengan tanggal ≥ hari ini yang belum selesai, per jenis (Speed / Easy / Easy-atau-Long). Aturan 1 menang atas aturan 2 pada sesi yang sama.
- Rata-rata EF 14 hari = sesi ber-EF dalam 14 hari sebelum sesi terakhir, tidak termasuk sesi terakhir, semua jenis sesi (sama seperti spesifikasi; membandingkan EF antarintensitas bisa bias).
- Drift tidak diketahui (tanpa lap/HR) dianggap ≤ 5% untuk aturan 4.
- Bila proyeksi sudah lebih cepat dari target, pace ditahan di pace target (rumus apa adanya akan melambat).
- Estimasi durasi sesi Speed = jumlah langkah berdurasi, minimal 30 menit. Sesi bernama jarak dikonversi lewat easy pace (zona VDOT, default 6:00/km). Persen long run Base (35%), ambang label peluang (2/5/10%) juga asumsi.
- Blok puncak tetap templat Nike 5K walau jarak target lain; hint pace chart mengikuti input 5K, dan pace target PB mengikuti jarak target. Volume akhir Base bisa jauh di atas volume minggu pertama Nike; itu sifat templatnya.
- `PB` di sini = proyeksi Riegel saat ini (aplikasi belum menyimpan PB terpisah).
- `tsconfig.json`: `allowImportingTsExtensions` diaktifkan agar modul yang diuji lewat `node --experimental-strip-types` bisa saling impor.
