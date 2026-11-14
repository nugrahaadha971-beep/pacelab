import type { ReactNode } from 'react';
import type { UserProfile, Workout } from '../analytics/types';
import { acwr, DAY_MS } from '../analytics/workload';
import CoachCard from './CoachCard';
import QuickLog from './QuickLog';

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-navy-800 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-emerald-400">{value}</div>
    </div>
  );
}

export default function Beranda({ profile, workouts, reload }: { profile: UserProfile; workouts: Workout[]; reload: () => void }) {
  const t = Date.now();
  const load = acwr(workouts, profile, t);
  const km7 = workouts.filter((w) => w.date > t - 7 * DAY_MS).reduce((s, w) => s + w.distanceKm, 0);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Beranda</h1>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="TRIMP 7 hari" value={Math.round(load.acute)} />
        <Stat label="ACWR" value={load.ratio == null ? '–' : load.ratio.toFixed(2)} />
        <Stat label="Jarak 7 hari" value={`${km7.toFixed(1)} km`} />
      </div>
      <CoachCard workouts={workouts} profile={profile} />
      <QuickLog profile={profile} onSaved={reload} />
    </div>
  );
}
