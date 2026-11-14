import { useState, type CSSProperties } from 'react';
import { NIKE_5K_PLAN, type Session } from '../plans/nike5k';
import { fmtPace, nearestRow, paceKeyFor, targetFor } from '../plans/pace';
import { parseDuration } from '../parsers/manual';

const KIND_LABEL: Record<Session['kind'], string> = {
  recovery: 'Recovery Run', speed: 'Speed Run', long: 'Long Run', race: 'Race Day',
};
const card: CSSProperties = { background: '#131a22', borderRadius: 12, padding: 12, margin: '12px 0', display: 'grid', gap: 8 };

export default function TrainingPlan() {
  const [weekIdx, setWeekIdx] = useState(0);
  const [k5Text, setK5Text] = useState('');
  const k5 = parseDuration(k5Text);
  const row = k5 != null ? nearestRow(k5) : null;
  const week = NIKE_5K_PLAN[weekIdx];

  // Recovery & Long Run = recovery pace; Race Day = 5K pace.
  const hintFor = (s: Session): string | null =>
    s.kind === 'race' ? targetFor('k5', row) : s.kind === 'recovery' || s.kind === 'long' ? targetFor('rec', row) : null;

  return (
    <section style={card}>
      <strong>Rencana 8 Minggu · Nike Run Club 5K</strong>
      <label>5K terbaru Anda (MM:SS)
        <input value={k5Text} onChange={(e) => setK5Text(e.target.value)} placeholder="27:00" />
      </label>
      {k5Text && k5 == null && <span>Format waktu tidak valid.</span>}
      {row && <span>Baris Pace Chart: 5K {fmtPace(row[1])} · Mile best {fmtPace(row[0])}/mi</span>}
      <select value={weekIdx} onChange={(e) => setWeekIdx(Number(e.target.value))}>
        {NIKE_5K_PLAN.map((w, i) => <option key={w.label} value={i}>{w.label}</option>)}
      </select>
      {week.sessions.map((s, i) => (
        <div key={i} style={{ borderTop: '1px solid #223', paddingTop: 8 }}>
          <strong>{KIND_LABEL[s.kind]} · {s.name}</strong>
          {s.steps.map((st, j) => {
            const t = targetFor(paceKeyFor(st), row);
            return <div key={j}>{st}{t && <em> → {t}</em>}</div>;
          })}
          {hintFor(s) && <div>Target: {hintFor(s)}</div>}
        </div>
      ))}
    </section>
  );
}
