import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vdot, velocityFor, ZONE_FRACTION } from './predictor.ts';
import { cardiacDrift } from './workload.ts';
import { coachAdvice } from './coachEngine.ts';

const LAPS = [
  { km: 1, paceSec: 360, avgHr: 120 }, { km: 2, paceSec: 360, avgHr: 120 },
  { km: 3, paceSec: 360, avgHr: 130 }, { km: 4, paceSec: 360, avgHr: 130 },
];
const base = { acwrRatio: 1, efImproving: false, lastType: 'easy' as const, daysSinceLast: 2, lastDrift: null };

test('VDOT 5K 20:00 ≈ 49,8', () => assert.ok(Math.abs(vdot(5000, 1200) - 49.8) < 0.2));

test('velocityFor: VO2 = fraksi × VDOT', () => {
  const v = velocityFor(50, 0.8);
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  assert.ok(Math.abs(vo2 - 40) < 1e-6);
});

test('zona pace berurutan easy < marathon < threshold < interval', () => {
  assert.ok(ZONE_FRACTION.easy < ZONE_FRACTION.marathon && ZONE_FRACTION.marathon < ZONE_FRACTION.threshold && ZONE_FRACTION.threshold < ZONE_FRACTION.interval);
});

test('cardiac drift: HR 120 → 130 pada pace sama ≈ 7,7%', () => {
  assert.ok(Math.abs((cardiacDrift(LAPS) ?? NaN) - 7.69) < 0.1);
});

test('cardiac drift: kurang dari 4 lap → null', () => assert.equal(cardiacDrift(LAPS.slice(0, 3)), null));

test('kelelahan tinggi + sesi keras kemarin → istirahat', () => {
  const a = coachAdvice({ ...base, acwrStatus: 'high_fatigue', acwrRatio: 1.5, lastType: 'tempo', daysSinceLast: 1 });
  assert.equal(a.session, 'rest');
});

test('beban rendah → Easy Run +10 menit', () => {
  const a = coachAdvice({ ...base, acwrStatus: 'undertraining', acwrRatio: 0.6 });
  assert.equal(a.session, 'easy');
  assert.equal(a.durationAddMin, 10);
});

test('beban optimal, sesi terakhir easy → tempo', () => {
  assert.equal(coachAdvice({ ...base, acwrStatus: 'sweet_spot' }).session, 'tempo');
});

test('drift di atas ambang muncul di saran; EF membaik → catatan', () => {
  const a = coachAdvice({ ...base, acwrStatus: 'sweet_spot', lastDrift: 8, efImproving: true });
  assert.match(a.detail, /Cardiac drift/);
  assert.equal(a.efNote, 'Kapasitas Aerobik Meningkat');
});
