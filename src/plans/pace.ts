// Pace Chart PDF: [mile best, 5K total, 5K avg mile, 10K avg mile, tempo avg mile, recovery day pace], detik.
export const PACE_CHART: number[][] = [
  [300, 1025, 330, 345, 365, 420], [330, 1125, 360, 375, 395, 455], [360, 1215, 390, 405, 425, 490],
  [390, 1320, 425, 440, 460, 525], [420, 1425, 460, 475, 495, 560], [450, 1515, 485, 505, 530, 595],
  [480, 1620, 520, 540, 565, 630], [510, 1710, 550, 570, 595, 660], [540, 1800, 580, 600, 630, 695],
  [570, 1905, 615, 635, 660, 730], [600, 1980, 640, 665, 695, 765], [630, 2100, 675, 695, 720, 800],
  [660, 2175, 700, 720, 755, 825], [690, 2280, 735, 755, 780, 845], [720, 2370, 760, 785, 815, 870],
];

export type PaceKey = 'mile' | 'k5' | 'k10' | 'tempo' | 'rec' | 'best';
const COL = { mile: 0, k5: 2, k10: 3, tempo: 4, rec: 5 } as const;

export function fmtPace(sec: number): string {
  const x = Math.round(sec);
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
}

/** Baris Pace Chart dengan waktu 5K terdekat. */
export function nearestRow(k5TotalSec: number): number[] {
  return PACE_CHART.reduce((a, r) => (Math.abs(r[1] - k5TotalSec) < Math.abs(a[1] - k5TotalSec) ? r : a));
}

/** Jenis pace dari teks langkah; hanya baris yang diawali durasi/jumlah set. */
export function paceKeyFor(step: string): PaceKey | null {
  if (!/^(\d+ x )?\d/.test(step)) return null;
  const s = step.toLowerCase();
  if (s.includes('recovery run pace')) return 'rec';
  if (s.includes('5k pace')) return 'k5';
  if (s.includes('10k pace')) return 'k10';
  if (s.includes('mile pace')) return 'mile';
  if (s.includes('best pace')) return 'best';
  if (s.includes('tempo run')) return 'tempo';
  return null;
}

export function targetFor(key: PaceKey | null, row: number[] | null): string | null {
  if (!key) return null;
  if (key === 'best') return 'sesuai effort Anda';
  if (!row) return null;
  const sec = row[COL[key]];
  return `${fmtPace(sec)}/mi · ${fmtPace(sec / 1.609344)}/km`;
}
