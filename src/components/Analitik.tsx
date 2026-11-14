import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RaceDistance, UserProfile, Workout } from '../analytics/types';
import { acwr, DAY_MS, efficiencyFactor } from '../analytics/workload';
import { predictAll, RACE_KM } from '../analytics/predictor';
import { fmtHms } from './format';
import { weeklyKm } from './historyFilter';
import AcwrGauge from './AcwrGauge';

const RANGES = [7, 28, 90] as const;
type Range = (typeof RANGES)[number];
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
  const [days, setDays] = useState<Range>(28);
  const now = Date.now();
  const inRange = workouts.filter((w) => w.date <= now && now - w.date <= days * DAY_MS);
  const current = acwr(workouts, profile, now);
  const acwrData = Array.from({ length: days }, (_, i) => {
    const ts = now - (days - 1 - i) * DAY_MS;
    return { d: short(ts), acwr: acwr(workouts, profile, ts).ratio };
  });
  const acwrMax = Math.max(2, Math.ceil(Math.max(0, ...acwrData.map((d) => d.acwr ?? 0)) * 2) / 2);
  const efData = inRange
    .filter((w) => w.workoutType === 'easy' || w.workoutType === 'long_run')
    .sort((a, b) => a.date - b.date)
    .map((w) => ({ d: short(w.date), ef: w.efficiencyFactor ?? efficiencyFactor(w) }));
  const weekly = weeklyKm(workouts, now, Math.max(1, Math.round(days / 7)));
  const preds = predictAll(workouts, now);
  const dists = Object.keys(RACE_KM) as RaceDistance[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Analitik</h1>
      <Card title="Beban akut : kronis (ACWR)">
        <AcwrGauge ratio={current.ratio} status={current.status} />
        <p className="mt-2 text-center text-xs tabular-nums text-slate-400">
          Akut 7 hari {Math.round(current.acute)} · Kronis (rata-rata mingguan) {Math.round(current.chronicWeekly)}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2 rounded-xl bg-navy-800 p-1">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setDays(r)}
            className={`rounded-lg py-2 text-sm font-semibold ${days === r ? 'bg-coral text-navy-900' : 'text-slate-300'}`}>
            {r} Hari
          </button>
        ))}
      </div>

      {inRange.length === 0 ? (
        <p className="rounded-xl bg-navy-800 p-6 text-center text-sm text-slate-400">
          Belum ada sesi dalam {days} hari terakhir. Impor atau catat sesi di Beranda.
        </p>
      ) : (
        <>
          <Card title={`ACWR · ${days} hari`}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={acwrData}>
                <CartesianGrid stroke="#1d2a40" vertical={false} />
                <ReferenceArea y1={0.8} y2={1.3} fill="#34d399" fillOpacity={0.12} />
                <XAxis dataKey="d" hide />
                <YAxis domain={[0, acwrMax]} {...axis} width={28} />
                <Tooltip {...tip} />
                <Line dataKey="acwr" stroke="#ff6b5e" dot={false} connectNulls strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title={`Efisiensi Aerobik · ${days} hari`}>
            {efData.length === 0 ? (
              <p className="text-sm text-slate-400">Belum ada sesi easy atau long run dalam rentang ini.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={efData}>
                  <CartesianGrid stroke="#1d2a40" vertical={false} />
                  <XAxis dataKey="d" {...axis} minTickGap={24} />
                  <YAxis {...axis} width={36} domain={['auto', 'auto']} />
                  <Tooltip {...tip} />
                  <Line dataKey="ef" stroke="#34d399" dot={{ r: 3 }} connectNulls strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card title="Volume mingguan (km)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekly}>
                <CartesianGrid stroke="#1d2a40" vertical={false} />
                <XAxis dataKey="label" {...axis} />
                <YAxis {...axis} width={28} />
                <Tooltip {...tip} />
                <Bar dataKey="km" fill="#ff6b5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

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
