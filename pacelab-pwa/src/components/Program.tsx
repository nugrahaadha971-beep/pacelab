import type { Workout } from '../analytics/types';
import { currentVdot, velocityFor, ZONE_FRACTION } from '../analytics/predictor';
import { fmtPace } from '../plans/pace';
import TrainingPlan from './TrainingPlan';

type Zone = keyof typeof ZONE_FRACTION;
const ZONE_NAME: Record<Zone, string> = { easy: 'Easy', marathon: 'Marathon', threshold: 'Threshold', interval: 'Interval' };

export default function Program({ workouts }: { workouts: Workout[] }) {
  const vd = currentVdot(workouts, Date.now());
  const zones = Object.keys(ZONE_FRACTION) as Zone[];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Program</h1>
      <section className="rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Zona pace · VDOT {vd == null ? '–' : vd.toFixed(1)}</h2>
        {vd == null ? (
          <p className="mt-2 text-sm text-slate-400">Butuh sesi ≥ 3 km dalam 42 hari terakhir.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 tabular-nums">
            {zones.map((z) => (
              <div key={z} className="rounded-lg bg-navy-900 p-3">
                <div className="text-[11px] uppercase text-slate-400">{ZONE_NAME[z]}</div>
                <div className="font-semibold">{fmtPace(60000 / velocityFor(vd, ZONE_FRACTION[z]))} /km</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <TrainingPlan />
    </div>
  );
}
