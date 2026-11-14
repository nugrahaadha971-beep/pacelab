import type { CSSProperties } from 'react';
import type { UserProfile, Workout } from '../analytics/types';
import { acwr, efTrend, cardiacDrift, DAY_MS } from '../analytics/workload';
import { currentVdot, velocityFor, ZONE_FRACTION } from '../analytics/predictor';
import { coachAdvice } from '../analytics/coachEngine';
import type { SessionRec } from '../analytics/coachEngine';
import { fmtPace } from '../plans/pace';

const card: CSSProperties = { background: '#131a22', borderRadius: 12, padding: 12, margin: '12px 0', display: 'grid', gap: 6 };
const SESSION: Record<SessionRec, string> = {
  easy: 'Easy Run', tempo: 'Tempo Run', interval: 'Interval', long_run: 'Long Run', recovery: 'Recovery Run', rest: 'Istirahat',
};
const ZONE: Record<keyof typeof ZONE_FRACTION, string> = { easy: 'Easy', marathon: 'Marathon', threshold: 'Threshold', interval: 'Interval' };

export default function CoachCard({ workouts, profile }: { workouts: Workout[]; profile: UserProfile }) {
  const t = Date.now();
  const load = acwr(workouts, profile, t);
  const ef = efTrend(workouts, t);
  const last = [...workouts].sort((a, b) => b.date - a.date)[0];
  const drift = last ? cardiacDrift(last.laps) : null;
  const advice = coachAdvice({
    acwrStatus: load.status,
    acwrRatio: load.ratio,
    efImproving: ef.improving,
    lastType: last?.workoutType ?? null,
    daysSinceLast: last ? (t - last.date) / DAY_MS : null,
    lastDrift: drift,
  });
  const vd = currentVdot(workouts, t);

  return (
    <section style={card}>
      <strong>Saran Pelatih</strong>
      <span>{advice.headline}</span>
      <span>{advice.detail}</span>
      <span>Sesi berikutnya: {SESSION[advice.session]}{advice.durationAddMin ? ` (+${advice.durationAddMin} menit)` : ''}</span>
      {advice.efNote && <span>{advice.efNote}</span>}
      {drift != null && <span>Cardiac drift sesi terakhir: {drift.toFixed(1)}%</span>}
      {vd != null && (
        <>
          <strong>Zona pace (VDOT {vd.toFixed(1)})</strong>
          {(Object.keys(ZONE_FRACTION) as (keyof typeof ZONE_FRACTION)[]).map((z) => (
            <span key={z}>{ZONE[z]}: {fmtPace(60000 / velocityFor(vd, ZONE_FRACTION[z]))} /km</span>
          ))}
        </>
      )}
    </section>
  );
}
