// Program MAF (Maximum Aerobic Function, metode Phil Maffetone). Murni (tanpa UI).
// Semua lari dilakukan di zona detak jantung MAF; pace adalah hasil, bukan target.
import { cardiacDrift } from '../analytics/workload.ts';
import type { Workout } from '../analytics/types.ts';
import { MAF_BAND_BPM } from './hrZones.ts';
import type { TemplateSession, TemplateWeek } from './progressive5k.ts';

// ───────────────────────── Rumus 180 ─────────────────────────

/** Penyesuaian kondisi menurut rumus 180 Maffetone. */
export type MafAdjustment = -10 | -5 | 0 | 5;

export const MAF_ADJUSTMENTS: ReadonlyArray<{ value: MafAdjustment; label: string }> = [
  { value: -10, label: 'Baru pulih dari sakit/operasi berat, atau rutin minum obat (−10)' },
  { value: -5, label: 'Cedera, performa menurun, sering flu/pilek (> 2 kali/tahun), atau alergi (−5)' },
  { value: 0, label: 'Berlatih teratur sampai 2 tahun, atau baru mulai, tanpa masalah (0)' },
  { value: 5, label: 'Berlatih > 2 tahun tanpa cedera dan terus membaik (+5)' },
];

export const normalizeMafAdj = (raw: unknown): MafAdjustment =>
  raw === -10 || raw === -5 || raw === 5 ? raw : 0;

/** Usia ≤ 16: dipakai 165 tetap (bukan 180 − usia). Usia tidak valid → null. */
export const MAF_YOUTH_AGE = 16;
export const MAF_YOUTH_HR = 165;

/** HR MAF = 180 − usia + penyesuaian (usia ≤ 16 → 165 + penyesuaian). Tambahan untuk usia > 65 tidak otomatis. */
export function mafHr(age: number | null | undefined, adj: MafAdjustment = 0): number | null {
  if (age == null || !Number.isFinite(age) || age < 5 || age > 100) return null;
  return (age <= MAF_YOUTH_AGE ? MAF_YOUTH_HR : 180 - Math.round(age)) + adj;
}

/** Zona latihan: HR MAF turun 10 bpm → HR MAF. */
export const mafZone = (maf: number): [number, number] => [maf - MAF_BAND_BPM, maf];

export const MAF_RULE =
  'Jaga detak jantung di antara batas bawah dan MAF. Jika melewati MAF (tanjakan, panas), perlambat atau jalan sampai turun—jangan mengejar pace.';

// ───────────────────────── MAF Test & pelacakan ─────────────────────────

export const MAF_MIN_KM = 3;
/** ASUMSI: HR rata-rata sesi dianggap "di zona MAF" bila −5…+3 bpm dari HR MAF. */
export const MAF_TOL_LOW = 5;
export const MAF_TOL_HIGH = 3;

export interface MafPoint {
  date: number;
  distanceKm: number;
  avgHr: number;
  paceSecPerKm: number;
  driftPct: number | null;
}

/**
 * Sesi easy/long run ≥ 3 km dengan HR rata-rata di sekitar HR MAF dianggap data pace-di-zona-MAF
 * (MAF Test resmi maupun lari biasa di zona yang sama). Urut dari yang terlama.
 */
export function mafTests(workouts: Workout[], maf: number | null): MafPoint[] {
  if (maf == null) return [];
  return workouts
    .filter((w) => (w.workoutType === 'easy' || w.workoutType === 'long_run')
      && w.distanceKm >= MAF_MIN_KM && w.durationSec > 0 && w.avgHr != null
      && w.avgHr >= maf - MAF_TOL_LOW && w.avgHr <= maf + MAF_TOL_HIGH)
    .sort((a, b) => a.date - b.date)
    .map((w) => ({
      date: w.date, distanceKm: w.distanceKm, avgHr: w.avgHr as number,
      paceSecPerKm: w.avgPaceSecPerKm > 0 ? w.avgPaceSecPerKm : w.durationSec / w.distanceKm,
      driftPct: cardiacDrift(w.laps),
    }));
}

export interface MafTrend { firstPace: number; lastPace: number; deltaSec: number; count: number }

/** Selisih pace pertama → terakhir (negatif = makin cepat di HR yang sama = fondasi aerobik membaik). */
export function mafTrend(points: MafPoint[]): MafTrend | null {
  if (points.length < 2) return null;
  const first = points[0].paceSecPerKm, last = points[points.length - 1].paceSecPerKm;
  return { firstPace: first, lastPace: last, deltaSec: last - first, count: points.length };
}

// ───────────────────────── Kurikulum MAF 12 minggu ─────────────────────────

const SAT = 6;
const WARM = "Pemanasan 10–15': jalan cepat, lalu lari sangat pelan sampai HR masuk zona MAF";
const COOL = "Pendinginan 5–10': jalan santai";
/** ASUMSI: pace nominal untuk memperkirakan total durasi MAF Test 5 km (bukan target). */
const NOMINAL_TEST_SEC_KM = 600;

const run = (min: number, kind: 'recovery' | 'long' = 'recovery', label = 'di zona MAF'): TemplateSession => ({
  kind, zone: 'maf', durationMin: min, name: `${min}' ${label}`,
  steps: [WARM, `Lari ${min} menit dengan HR di antara batas bawah dan MAF. Jika HR melewati MAF, perlambat atau jalan sampai HR turun.`, COOL],
});
const long = (min: number) => run(min, 'long', 'Long Run di zona MAF');
const shake = (min: number) => run(min, 'recovery', 'shake-out di zona MAF');
const test = (): TemplateSession => ({
  kind: 'speed', zone: 'maf', test: 'maf', fixedWeekday: SAT,
  durationMin: Math.round(15 + (5 * NOMINAL_TEST_SEC_KM) / 60 + 5),
  name: 'MAF Test 5 km',
  steps: [
    "Pemanasan 15': jalan cepat, lalu lari makin cepat sampai HR mencapai MAF",
    'Lari 5 km dengan HR stabil di MAF (jangan lebih). Catat waktu tiap km; km terakhir biasanya paling lambat.',
    "Pendinginan 5': jalan santai",
  ],
});

/** Tiap minggu: 3 lari MAF + 1 Long Run (Sel/Kam/Sab/Min). Minggu 4 dan 8 ringan + MAF Test (Sabtu). Minggu 12 = taper + lomba. */
export const MAF_5K: TemplateWeek[] = [
  { title: 'Fondasi Aerobik MAF', sessions: [run(30), run(30), run(30), long(45)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(30), run(30), run(35), long(50)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(30), run(35), run(35), long(55)] },
  { title: 'Ringan + MAF Test', deload: true, sessions: [run(30), run(30), test(), long(40)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(35), run(35), run(40), long(60)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(40), run(40), run(40), long(65)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(40), run(45), run(45), long(70)] },
  { title: 'Ringan + MAF Test', deload: true, sessions: [run(35), run(35), test(), long(45)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(45), run(45), run(50), long(75)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(45), run(50), run(50), long(80)] },
  { title: 'Fondasi Aerobik MAF', sessions: [run(40), run(40), run(45), long(70)] },
  { title: 'Taper & Lomba', sessions: [run(30), run(20), shake(15)] },
];

export const MAF_RACE_STEPS = [
  'Hari lomba bukan sesi zona MAF: HR akan melewati MAF dan itu wajar. Km 1 sedikit lebih lambat dari pace target, km tengah stabil, keluarkan sisa tenaga di km akhir.',
  'Program MAF membangun fondasi aerobik. Manfaat penuhnya biasanya terlihat setelah 3–6 bulan, jadi catat pace MAF Test sebagai ukuran kemajuan, bukan hanya waktu lomba.',
];
