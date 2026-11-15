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
      <Card title="Rasio beban (ACWR)">
        <AcwrGauge ratio={current.ratio} status={current.status} />
        <p className="mt-2 text-center text-sm tabular-nums text-slate-400">
          Beban 7 hari {Math.round(current.acute)} · Rata-rata mingguan sebelumnya {Math.round(current.chronicWeekly)}
        </p>
        <p className="mt-1 text-center text-xs text-slate-400">Rasio antara 0,8 dan 1,3 dianggap aman.</p>
      </Card>

      <div role="group" aria-label="Rentang waktu grafik" className="grid grid-cols-3 gap-1 rounded-2xl bg-navy-800 p-1">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}
            className={`min-h-11 rounded-xl text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
              days === r ? 'bg-gradient-to-r from-coral to-orange-400 text-navy-900' : 'text-slate-300'
            }`}>
            {r} hari
          </button>
        ))}
      </div>

      {inRange.length === 0 ? (
        <p className="rounded-xl bg-navy-800 p-6 text-center text-sm text-slate-400">
          Belum ada sesi dalam {days} hari terakhir. Ketuk tombol + di pojok kanan bawah untuk mencatat sesi.
        </p>
      ) : (
        <>
          <Card title={`Rasio beban (ACWR) · ${days} hari`}>
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
            <p className="mt-1 text-xs text-slate-400">Area hijau (0,8–1,3) adalah rentang aman. Garis di dalam area itu berarti beban seimbang.</p>
          </Card>
          <Card title={`Efisiensi aerobik (EF) · ${days} hari`}>
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

      <Card title="Prediksi waktu lomba (Riegel)">
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
