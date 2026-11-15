import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { RaceDistance, UserProfile, Workout } from '../analytics/types';
import { acwr, DAY_MS, efTrend } from '../analytics/workload';
import type { AcwrStatus } from '../analytics/workload';
import { predictAll, RACE_KM } from '../analytics/predictor';
import { fmtHms } from './format';
import { weeklyKm } from './historyFilter';
import CoachCard from './CoachCard';
import { InfoHint, StatCard, StatusPill } from './ui';
import type { Tone } from './ui';

const DISTS = Object.keys(RACE_KM) as RaceDistance[];
const tip = { contentStyle: { background: '#131c2e', border: '1px solid #1d2a40', color: '#e2e8f0', fontSize: 12 } };

/** Status beban dalam bahasa sehari-hari; istilah teknis dalam kurung. */
const STATUS: Record<AcwrStatus, { tone: Exclude<Tone, 'neutral'>; title: string; text: string; card: string; num: string }> = {
  unknown: {
    tone: 'info', title: 'Data belum cukup',
    text: 'Catat lebih banyak sesi agar status beban bisa dihitung.',
    card: 'border-sky-400/25 from-navy-800 to-navy-800', num: 'text-slate-300',
  },
  undertraining: {
    tone: 'warn', title: 'Beban masih ringan (Undertraining)',
    text: 'Beban Anda di bawah kebiasaan sebelumnya. Boleh menambah latihan sedikit demi sedikit.',
    card: 'border-amber-400/30 from-amber-950/60 to-navy-800', num: 'text-amber-400',
  },
  sweet_spot: {
    tone: 'good', title: 'Aman (Sweet Spot)',
    text: 'Beban seimbang dengan kebiasaan Anda. Lanjutkan sesuai jadwal.',
    card: 'border-emerald-400/30 from-emerald-950/70 to-navy-800', num: 'text-emerald-400',
  },
  high_fatigue: {
    tone: 'bad', title: 'Terlalu berat (High Fatigue)',
    text: 'Beban naik tajam dibanding kebiasaan Anda. Kurangi intensitas dan beri waktu untuk pulih.',
    card: 'border-coral/40 from-red-950/60 to-navy-800', num: 'text-coral',
  },
};

export default function Beranda({ profile, workouts }: { profile: UserProfile; workouts: Workout[] }) {
  const t = Date.now();
  const load = acwr(workouts, profile, t);
  const ef = efTrend(workouts, t);
  const preds = predictAll(workouts, t);
  const km7 = workouts.filter((w) => w.date > t - 7 * DAY_MS).reduce((s, w) => s + w.distanceKm, 0);
  const weeks = weeklyKm(workouts, t, 8);
  const efSub = ef.changePct == null ? 'tren 14 hari: –' : `${ef.changePct >= 0 ? '+' : ''}${ef.changePct.toFixed(1)}% vs 14 hari lalu`;
  const st = STATUS[load.status];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Beranda</h1>
      {workouts.length === 0 && (
        <section className="rounded-2xl border border-dashed border-coral/60 bg-coral/10 p-4 text-sm text-slate-200">
          Belum ada sesi. Ketuk tombol <strong>+</strong> di pojok kanan bawah untuk mengimpor berkas .FIT/.GPX atau mencatat sesi manual. Setelah itu saran pelatih, prediksi, dan grafik akan aktif.
        </section>
      )}

      <section aria-label="Status latihan" className={`rounded-2xl border bg-gradient-to-br p-4 ${st.card}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status latihan hari ini</div>
            <div className="mt-2"><StatusPill tone={st.tone}>{st.title}</StatusPill></div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-3xl font-extrabold tabular-nums ${st.num}`}>{load.ratio == null ? '–' : load.ratio.toFixed(2)}</div>
            <div className="text-[11px] text-slate-400">Rasio beban</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">{st.text}</p>
        <div className="mt-2 text-xs text-slate-400">
          <InfoHint label="Apa itu rasio beban?" term="ACWR">
            Membandingkan beban latihan 7 hari terakhir dengan rata-rata mingguan sebelumnya. Antara 0,8 dan 1,3 dianggap aman.
          </InfoHint>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Beban 7 hari" term="TRIMP" value={Math.round(load.acute)} />
        <StatCard label="Jarak 7 hari" value={km7.toFixed(1)} unit="km" />
        <StatCard label="Efisiensi lari" term="EF" value={ef.recent == null ? '–' : ef.recent.toFixed(2)} context={efSub} />
        <StatCard label="Rasio beban" term="ACWR" value={load.ratio == null ? '–' : load.ratio.toFixed(2)} tone={st.tone} context={st.title} />
      </div>

      <section className="rounded-2xl border border-white/5 bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Volume mingguan · 8 minggu terakhir (km)</h2>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weeks} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
            <Tooltip {...tip} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="km" radius={[5, 5, 2, 2]}>
              {weeks.map((_, i) => <Cell key={i} fill={i === weeks.length - 1 ? '#ff6b5e' : '#ff6b5e66'} />)}
              <LabelList dataKey="km" position="top" fill="#94a3b8" fontSize={10}
                formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? Math.round(v) : '')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-400">Batang terang adalah minggu terbaru.</p>
      </section>

      <CoachCard workouts={workouts} profile={profile} />

      <section className="rounded-2xl border border-white/5 bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Prediksi waktu lomba <span className="font-normal text-slate-400">(Riegel)</span></h2>
        <div className="mt-2 grid grid-cols-2 gap-2 tabular-nums">
          {DISTS.map((d) => {
            const p = preds[d];
            return (
              <div key={d} className="rounded-xl bg-navy-900 p-3">
                <div className="text-[11px] font-bold uppercase text-slate-400">{d}</div>
                <div className="text-lg font-bold">{p ? fmtHms(p.finalSec) : '–'}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
