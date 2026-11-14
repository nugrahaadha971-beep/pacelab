import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { RaceDistance, UserProfile, Workout } from '../analytics/types';
import { acwr, DAY_MS, efTrend } from '../analytics/workload';
import { predictAll, RACE_KM } from '../analytics/predictor';
import { fmtHms } from './format';
import { weeklyKm } from './historyFilter';
import CoachCard from './CoachCard';
import QuickLog from './QuickLog';

const DISTS = Object.keys(RACE_KM) as RaceDistance[];
const tip = { contentStyle: { background: '#131c2e', border: '1px solid #1d2a40', color: '#e2e8f0', fontSize: 12 } };

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-navy-800 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-emerald-400">{value}</div>
      {sub && <div className="text-[11px] tabular-nums text-slate-400">{sub}</div>}
    </div>
  );
}

export default function Beranda({ profile, workouts, reload }: { profile: UserProfile; workouts: Workout[]; reload: () => void }) {
  const t = Date.now();
  const load = acwr(workouts, profile, t);
  const ef = efTrend(workouts, t);
  const preds = predictAll(workouts, t);
  const km7 = workouts.filter((w) => w.date > t - 7 * DAY_MS).reduce((s, w) => s + w.distanceKm, 0);
  const weeks = weeklyKm(workouts, t, 8);
  const efSub = ef.changePct == null ? 'tren 14 hari: –' : `${ef.changePct >= 0 ? '+' : ''}${ef.changePct.toFixed(1)}% vs 14 hari lalu`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Beranda</h1>
      {workouts.length === 0 && (
        <section className="rounded-xl border border-dashed border-coral/60 bg-coral/10 p-4 text-sm text-slate-200">
          Belum ada sesi. Impor berkas .FIT/.GPX atau catat sesi manual di bawah untuk mengaktifkan saran pelatih, prediksi, dan grafik.
        </section>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="TRIMP 7 hari" value={Math.round(load.acute)} />
        <Stat label="ACWR" value={load.ratio == null ? '–' : load.ratio.toFixed(2)} />
        <Stat label="Jarak 7 hari" value={`${km7.toFixed(1)} km`} />
        <Stat label="EF · 14 hari" value={ef.recent == null ? '–' : ef.recent.toFixed(2)} sub={efSub} />
      </div>
      <section className="rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Prediksi lomba (Riegel)</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 tabular-nums">
          {DISTS.map((d) => {
            const p = preds[d];
            return (
              <div key={d} className="rounded-lg bg-navy-900 p-3">
                <div className="text-[11px] uppercase text-slate-400">{d}</div>
                <div className="font-semibold">{p ? fmtHms(p.finalSec) : '–'}</div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Volume mingguan · 8 minggu</h2>
        <ResponsiveContainer width="100%" height={96}>
          <BarChart data={weeks}>
            <XAxis dataKey="label" hide />
            <Tooltip {...tip} />
            <Bar dataKey="km" fill="#ff6b5e" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <CoachCard workouts={workouts} profile={profile} />
      <QuickLog profile={profile} onSaved={reload} />
    </div>
  );
}
