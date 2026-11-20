import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mafHr, mafZone, mafTests, mafTrend, MAF_5K, MAF_ADJUSTMENTS, normalizeMafAdj, MAF_TOL_HIGH, MAF_TOL_LOW } from './maf.ts';
import { buildPlan, flattenPlan, weekdayOf, dayNum } from './schedule.ts';
import type { PlanOptions, PlanSession } from './schedule.ts';
import { applyAdaptation } from './adaptiveEngine.ts';
import { hrRange } from './hrZones.ts';
import { normalizePlanMode, PLAN_LABEL, resolvePlan, selectBestPlan } from './planSelector.ts';
import { DAY_MS } from '../analytics/workload.ts';
import type { Workout } from '../analytics/types.ts';

// ── Rumus 180 ──────────────────────────────────────────────────────────────

test('HR MAF = 180 − usia, dengan penyesuaian −10 / −5 / 0 / +5', () => {
  assert.equal(mafHr(30), 150);
  assert.equal(mafHr(30, 0), 150);
  assert.equal(mafHr(30, -10), 140);
  assert.equal(mafHr(30, -5), 145);
  assert.equal(mafHr(30, 5), 155);
  assert.equal(mafHr(45, -5), 130);
  assert.equal(mafHr(34.6), 145, 'usia dibulatkan');
});

test('HR MAF: usia ≤ 16 memakai 165 tetap; usia tidak valid → null', () => {
  assert.equal(mafHr(16), 165);
  assert.equal(mafHr(12, -5), 160);
  assert.equal(mafHr(17), 163);
  assert.equal(mafHr(0), null);
  assert.equal(mafHr(150), null);
  assert.equal(mafHr(NaN), null);
  assert.equal(mafHr(null), null);
  assert.equal(mafHr(undefined), null);
});

test('zona MAF = HR MAF turun 10 bpm → HR MAF; hrRange("maf") memakai nilai absolut, bukan persen HR maks', () => {
  assert.deepEqual(mafZone(150), [140, 150]);
  assert.deepEqual(hrRange('maf', 182, 150), [140, 150]);
  assert.deepEqual(hrRange('maf', null, 150), [140, 150], 'tidak butuh HR maks');
  assert.equal(hrRange('maf', 182, null), null);
  assert.deepEqual(hrRange('easy', 182), [130, 150], 'zona lain tidak berubah');
});

test('opsi penyesuaian: 4 pilihan; nilai tersimpan yang tidak valid → 0', () => {
  assert.deepEqual(MAF_ADJUSTMENTS.map((a) => a.value), [-10, -5, 0, 5]);
  assert.equal(normalizeMafAdj(-10), -10);
  assert.equal(normalizeMafAdj(5), 5);
  assert.equal(normalizeMafAdj(7), 0);
  assert.equal(normalizeMafAdj(NaN), 0);
  assert.equal(normalizeMafAdj('x'), 0);
});

// ── MAF Test & pelacakan ───────────────────────────────────────────────────

const NOW = Date.parse('2026-12-20T12:00:00Z');
const wk = (daysAgo: number, o: Partial<Workout> = {}): Workout => ({
  date: NOW - daysAgo * DAY_MS, source: 'manual', workoutType: 'easy', distanceKm: 5, durationSec: 3000, avgPaceSecPerKm: 600,
  avgHr: 148, maxHr: 160, avgCadence: null, elevationGain: null, rpe: null, laps: [], ...o,
});

test('mafTests: easy/long ≥ 3 km dengan HR rata-rata −5…+3 bpm dari HR MAF; urut dari terlama', () => {
  assert.equal(MAF_TOL_LOW, 5);
  assert.equal(MAF_TOL_HIGH, 3);
  const ws = [
    wk(2, { avgHr: 153 }), // +3 → masuk
    wk(30, { avgHr: 145 }), // −5 → masuk
    wk(10, { avgHr: 154 }), // +4 → keluar
    wk(11, { avgHr: 144 }), // −6 → keluar
    wk(12, { distanceKm: 2.9, durationSec: 1700 }), // < 3 km → keluar
    wk(13, { workoutType: 'interval' }), // bukan sesi aerobik
    wk(14, { workoutType: 'race' }),
    wk(15, { avgHr: null }),
    wk(5, { workoutType: 'long_run', distanceKm: 8, durationSec: 5000, avgPaceSecPerKm: 625 }),
  ];
  const t = mafTests(ws, 150);
  assert.deepEqual(t.map((p) => Math.round((NOW - p.date) / DAY_MS)), [30, 5, 2]);
  assert.equal(t[1].distanceKm, 8);
  assert.equal(mafTests(ws, null).length, 0);
});

test('mafTests: drift dari lap; mafTrend = selisih pace pertama → terakhir (negatif = membaik)', () => {
  const laps = [140, 140, 150, 150].map((hr, i) => ({ km: i + 1, paceSec: 600, avgHr: hr }));
  const p = mafTests([wk(30, { avgPaceSecPerKm: 660 }), wk(1, { avgPaceSecPerKm: 630, laps })], 150);
  assert.ok(Math.abs((p[1].driftPct ?? 0) - 6.6667) < 0.001);
  assert.equal(p[0].driftPct, null);
  const tr = mafTrend(p);
  assert.deepEqual(tr, { firstPace: 660, lastPace: 630, deltaSec: -30, count: 2 });
  assert.equal(mafTrend([p[0]]), null);
  assert.equal(mafTrend([]), null);
});

// ── Kurikulum MAF 12 minggu ────────────────────────────────────────────────

const TODAY = '2026-11-15';
const opts = (o: Partial<PlanOptions> = {}): PlanOptions => ({
  raceIso: '2027-02-07', todayIso: TODAY, days: [2, 4, 6, 0], raceName: '5K · Hari Lomba',
  startWeeklyKm: 10, maxWeeklyKm: 40, easyPaceSecPerKm: 600, curriculum: 'maf', maxHr: 182, mafHr: 150, ...o,
});
const all = (p: ReturnType<typeof buildPlan>) => flattenPlan(p);
const mins = (s: { durationMin: number | null }[]) => s.reduce((a, b) => a + (b.durationMin ?? 0), 0);

test('templat MAF: 12 minggu; 4 sesi tiap minggu kecuali taper; MAF Test di minggu 4 dan 8', () => {
  assert.equal(MAF_5K.length, 12);
  assert.deepEqual(MAF_5K.slice(0, 11).map((w) => w.sessions.length), Array(11).fill(4));
  assert.equal(MAF_5K[11].sessions.length, 3);
  assert.deepEqual(MAF_5K.map((w, i) => (w.deload ? i + 1 : 0)).filter(Boolean), [4, 8]);
  assert.deepEqual(MAF_5K.map((w, i) => (w.sessions.some((s) => s.test === 'maf') ? i + 1 : 0)).filter(Boolean), [4, 8]);
  for (const w of MAF_5K) for (const s of w.sessions) assert.equal(s.zone, 'maf');
});

test('templat MAF: tanpa sesi anaerobik; hanya MAF Test yang berjenis speed', () => {
  for (const w of MAF_5K) for (const s of w.sessions) {
    if (s.kind === 'speed') assert.equal(s.test, 'maf');
    assert.ok(['recovery', 'long', 'speed'].includes(s.kind));
  }
});

test('templat MAF: volume menit naik ≤ 10%/minggu (dibanding minggu non-ringan sebelumnya)', () => {
  const total = MAF_5K.map((w) => w.sessions.reduce((a, s) => a + s.durationMin, 0));
  let prev = -1;
  for (let i = 0; i < 11; i++) {
    if (MAF_5K[i].deload) continue;
    if (prev > 0) assert.ok(total[i] <= prev * 1.1 + 1e-9, `minggu ${i + 1}: ${total[i]} vs ${prev}`);
    prev = total[i];
  }
});

test('templat MAF: Long Run ≥ lari MAF terpanjang + 15 menit pada minggu non-ringan', () => {
  for (const w of MAF_5K) {
    if (w.deload) continue;
    const lg = w.sessions.find((s) => s.kind === 'long');
    if (!lg) continue;
    const easyMax = Math.max(...w.sessions.filter((s) => s.kind === 'recovery').map((s) => s.durationMin));
    assert.ok(lg.durationMin - easyMax >= 15, w.title);
  }
});

test('buildPlan MAF: 12 minggu menuju 7 Feb 2027; minggu 1 = 16–22 Nov; hari Sel/Kam/Sab/Min', () => {
  const p = buildPlan(opts());
  assert.equal(p.weeksRemaining, 12);
  assert.equal(p.baseWeeks, 0);
  assert.equal(p.weeks.length, 12);
  assert.equal(p.weeks[0].startIso, '2026-11-16');
  assert.deepEqual(p.weeks[0].sessions.map((s) => s.date), ['2026-11-17', '2026-11-19', '2026-11-21', '2026-11-22']);
  assert.deepEqual(p.weeks[0].sessions.map((s) => s.durationMin), [30, 30, 30, 45]);
  assert.ok(all(p).filter((s) => s.kind !== 'race').every((s) => s.id.startsWith('m')));
});

test('buildPlan MAF: MAF Test Sabtu di minggu 4 (12 Des) dan minggu 8 (9 Jan); race tepat di tanggal lomba', () => {
  const p = buildPlan(opts());
  const tests = all(p).filter((s) => s.test === 'maf');
  assert.deepEqual(tests.map((s) => s.date), ['2026-12-12', '2027-01-09']);
  assert.ok(tests.every((s) => weekdayOf(s.date) === 6 && s.name === 'MAF Test 5 km'));
  const last = all(p).at(-1) as PlanSession;
  assert.equal(last.kind, 'race');
  assert.equal(last.date, '2027-02-07');
  assert.deepEqual(p.weeks[11].sessions.map((s) => s.date), ['2027-02-02', '2027-02-04', '2027-02-06', '2027-02-07']);
  assert.equal(p.weeks[11].phase, 'taper');
  assert.equal(p.weeks[11].sessions[1].durationMin, 20, 'taper tidak dipangkas dua kali');
});

test('buildPlan MAF: target bpm semua sesi MAF = zona MAF (140–150); race memakai zona race', () => {
  const p = buildPlan(opts());
  for (const s of all(p).filter((x) => x.kind !== 'race')) assert.deepEqual(s.hr, [140, 150], s.id);
  assert.deepEqual(all(p).at(-1)?.hr, [164, 173]);
  const adj = buildPlan(opts({ mafHr: 140 }));
  assert.deepEqual(adj.weeks[0].sessions[0].hr, [130, 140]);
  const noAge = buildPlan(opts({ mafHr: null }));
  assert.equal(noAge.weeks[0].sessions[0].hr, null);
});

test('buildPlan MAF: Long Run Minggu; skala mengikuti weeksRemaining (> 12 → Base MAF; < 12 → minggu terakhir)', () => {
  const p = buildPlan(opts());
  for (const w of p.weeks) { const lg = w.sessions.find((x) => x.kind === 'long'); if (lg) assert.equal(weekdayOf(lg.date), 0); }
  const long = buildPlan(opts({ raceIso: '2027-03-14' })); // 17 minggu
  assert.equal(long.baseWeeks, 5);
  assert.ok(long.weeks.slice(0, 5).every((w) => w.phase === 'base' && w.sessions.every((s) => s.zone === 'maf' && s.hr?.[1] === 150)));
  assert.equal(long.weeks[5].sessions[0].id, 'm0-0');
  assert.equal(all(long).at(-1)?.date, '2027-03-14');
  const short = buildPlan(opts({ raceIso: '2026-12-20' })); // 5 minggu
  assert.equal(short.weeks.length, 5);
  assert.equal(short.weeks[0].sessions[0].id.startsWith('m7-'), true);
  assert.equal(all(short).at(-1)?.kind, 'race');
});

test('buildPlan MAF: Base (sisa > 12 minggu) tetap memenuhi Long Run ≥ Easy + 1,5 km atau + 15 menit', () => {
  const p = buildPlan(opts({ raceIso: '2027-04-04', easyPaceSecPerKm: 541 }));
  for (const w of p.weeks.filter((x) => x.phase === 'base')) {
    const easy = w.sessions.filter((s) => s.kind === 'recovery');
    const lg = w.sessions.find((s) => s.kind === 'long');
    if (!lg || !easy.length) continue;
    const eKm = Math.max(...easy.map((s) => s.distanceKm as number)), eMin = Math.max(...easy.map((s) => s.durationMin as number));
    assert.ok((lg.distanceKm as number) - eKm >= 1.5 - 0.051 || (lg.durationMin as number) - eMin >= 15, `minggu ${w.weekNo}`);
  }
});

test('MAF Test tidak ikut aturan Speed: ACWR tinggi tidak mengubahnya jadi Recovery, EF naik tidak mempercepat pace', () => {
  const p = buildPlan(opts());
  const flat = all(p);
  const testS = flat.find((s) => s.test === 'maf') as PlanSession;
  const dec = { highLoad: true, efUp: true, efGainPct: 5, driftHigh: false, addVolume: false };
  const r = applyAdaptation(flat, dec, TODAY, new Set(), 182);
  const after = r.sessions.find((s) => s.id === testS.id) as PlanSession;
  assert.equal(after.kind, 'speed');
  assert.equal(after.paceDeltaSec, undefined);
  assert.equal(r.notes.length, 0);
  // Bonus beban rendah tetap ke Long Run MAF berikutnya
  const r2 = applyAdaptation(flat, { highLoad: false, efUp: false, efGainPct: null, driftHigh: false, addVolume: true }, TODAY, new Set(), 182);
  assert.equal(r2.notes.length, 1);
  assert.equal(r2.sessions.find((s) => s.id === r2.notes[0].sessionId)?.kind, 'long');
});

test('MAF tidak mengubah program lain: Nike & Progresif tetap sama; mode manual "maf" dikenali', () => {
  const nike = buildPlan(opts({ curriculum: 'nike5k', raceIso: '2027-01-10' }));
  assert.equal(nike.weeks.length, 8);
  assert.ok(all(nike).filter((s) => s.kind !== 'race').every((s) => s.id.startsWith('n') && s.zone !== 'maf'));
  const prog = buildPlan(opts({ curriculum: 'progressive5k', raceIso: '2027-01-31' }));
  assert.equal(prog.weeks.length, 11);
  assert.ok(all(prog).every((s) => s.zone !== 'maf'));
  assert.equal(normalizePlanMode('maf'), 'maf');
  assert.equal(normalizePlanMode('mmm'), 'auto');
  assert.ok(PLAN_LABEL.maf.includes('MAF'));
  const sel = selectBestPlan([], { maxHr: 182 }, { now: NOW, projected5kSec: 2000 });
  assert.notEqual(sel.plan, 'maf', 'rekomendasi otomatis tidak berubah');
  assert.equal(resolvePlan('maf', sel), 'maf');
  assert.equal(resolvePlan('auto', sel), sel.plan);
});

test('semua tanggal sesi MAF unik, tidak di masa lalu, dan berurutan', () => {
  const s = all(buildPlan(opts()));
  assert.equal(new Set(s.map((x) => x.date)).size, s.length);
  assert.ok(s.every((x) => dayNum(x.date) >= dayNum(TODAY)));
  assert.ok(mins(s) > 0);
});
