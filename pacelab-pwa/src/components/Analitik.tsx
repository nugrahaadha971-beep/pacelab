import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RaceDistance, UserProfile, Workout } from '../analytics/types';
import { acwr, DAY_MS, efficiencyFactor } from '../analytics/workload';
import { predictAll, RACE_KM } from '../analytics/predictor';
import { fmtHms } from './format';

const tip = { contentStyle: { background: '#131c2e', border: '1px solid #1d2a40', color: '#e2e8f0', fontSize: 12 } };
const axis = { stroke: '#64748b', fontSize: 11, tickLine: false };
const short = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-navy-800 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

export default function Analitik({ profile, workouts }: { profile: UserProfile; workouts: Workout[] }) {
  const now = Date.now();
  const acwrData = Array.from({ length: 42 }, (_, i) => {
    const ts = now - (41 - i) * DAY_MS;
    return { d: short(ts), acwr: acwr(workouts, profile, ts).ratio };
  });
  const efData = workouts
    .filter((w) => (w.workoutType === 'easy' || w.workoutType === 'long_run') && now - w.date <= 90 * DAY_MS)
    .sort((a, b) => a.date - b.date)
    .map((w) => ({ d: short(w.date), ef: w.efficiencyFactor ?? efficiencyFactor(w) }));
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const km = workouts.filter((w) => w.date > start && w.date <= end).reduce((s, w) => s + w.distanceKm, 0);
    return { w: `M${i + 1}`, km: Number(km.toFixed(1)) };
  });
  const preds = predictAll(workouts, now);
  const dists = Object.keys(RACE_KM) as RaceDistance[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Analitik</h1>
      <Card title="ACWR · 42 hari">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={acwrData}>
            <CartesianGrid stroke="#1d2a40" vertical={false} />
            <XAxis dataKey="d" hide />
            <YAxis domain={[0, 2]} {...axis} width={28} />
            <Tooltip {...tip} />
            <Line dataKey="acwr" stroke="#ff6b5e" dot={false} connectNulls strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Efisiensi Aerobik · 90 hari">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={efData}>
            <CartesianGrid stroke="#1d2a40" vertical={false} />
            <XAxis dataKey="d" {...axis} minTickGap={24} />
            <YAxis {...axis} width={36} domain={['auto', 'auto']} />
            <Tooltip {...tip} />
            <Line dataKey="ef" stroke="#34d399" dot={{ r: 3 }} connectNulls strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Volume mingguan (km)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekly}>
            <CartesianGrid stroke="#1d2a40" vertical={false} />
            <XAxis dataKey="w" {...axis} />
            <YAxis {...axis} width={28} />
            <Tooltip {...tip} />
            <Bar dataKey="km" fill="#ff6b5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Proyeksi Riegel">
        <div className="divide-y divide-navy-700 tabular-nums">
          {dists.map((d) => {
            const p = preds[d];
            return (
              <div key={d} className="flex justify-between py-2 text-sm">
                <span className="text-slate-400">{d}</span>
                <span className="font-semibold">{p ? fmtHms(p.finalSec) : '–'}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
