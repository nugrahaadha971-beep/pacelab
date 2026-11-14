import { useState } from 'react';
import { NIKE_5K_PLAN, type Session } from '../plans/nike5k';
import { fmtPace, nearestRow, paceKeyFor, targetFor } from '../plans/pace';
import { parseDuration } from '../parsers/manual';
import { fmtHms } from './format';

const KIND_LABEL: Record<Session['kind'], string> = {
  recovery: 'Recovery Run', speed: 'Speed Run', long: 'Long Run', race: 'Race Day',
};
const STORE_KEY = 'pacelab.k5';
const card = 'my-3 grid gap-2 rounded-xl bg-navy-800 p-4';
const input = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums text-slate-100 focus:border-coral focus:outline-none';

function loadSaved(): string | null {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}

export default function TrainingPlan({ defaultK5Sec = null }: { defaultK5Sec?: number | null }) {
  const [weekIdx, setWeekIdx] = useState(0);
  const [k5Text, setK5Text] = useState(() => loadSaved() ?? (defaultK5Sec != null ? fmtHms(defaultK5Sec) : ''));
  const [fromPrediction, setFromPrediction] = useState(() => loadSaved() == null && defaultK5Sec != null);
  const k5 = parseDuration(k5Text);
  const row = k5 != null ? nearestRow(k5) : null;
  const week = NIKE_5K_PLAN[weekIdx];

  const onChange = (v: string) => {
    setK5Text(v);
    setFromPrediction(false);
    try { localStorage.setItem(STORE_KEY, v); } catch { /* penyimpanan tidak tersedia: abaikan */ }
  };

  // Recovery & Long Run = recovery pace; Race Day = 5K pace.
  const hintFor = (s: Session): string | null =>
    s.kind === 'race' ? targetFor('k5', row) : s.kind === 'recovery' || s.kind === 'long' ? targetFor('rec', row) : null;

  return (
    <section className={card}>
      <strong>Rencana 8 Minggu · Nike Run Club 5K</strong>
      <label className="text-sm text-slate-300">5K terbaru Anda (MM:SS)
        <input value={k5Text} onChange={(e) => onChange(e.target.value)} placeholder="27:00" className={`${input} mt-1`} />
      </label>
      {fromPrediction && <span className="text-xs text-slate-400">Terisi dari prediksi Riegel Anda. Ubah bila punya hasil 5K terbaru.</span>}
      {k5Text && k5 == null && <span className="text-sm text-coral">Format waktu tidak valid.</span>}
      {row && <span className="text-sm tabular-nums">Baris Pace Chart: 5K {fmtPace(row[1])} · Mile best {fmtPace(row[0])}/mi</span>}
      <select value={weekIdx} onChange={(e) => setWeekIdx(Number(e.target.value))}
        className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-slate-100">
        {NIKE_5K_PLAN.map((w, i) => <option key={w.label} value={i}>{w.label}</option>)}
      </select>
      {week.sessions.map((s, i) => (
        <div key={i} className="border-t border-navy-700 pt-2">
          <strong>{KIND_LABEL[s.kind]} · {s.name}</strong>
          {s.steps.map((st, j) => {
            const t = targetFor(paceKeyFor(st), row);
            return <div key={j} className="text-sm">{st}{t && <em className="text-emerald-400"> → {t}</em>}</div>;
          })}
          {hintFor(s) && <div className="text-sm text-emerald-400">Target: {hintFor(s)}</div>}
        </div>
      ))}
    </section>
  );
}
