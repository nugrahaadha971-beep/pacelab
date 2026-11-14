import { useMemo, useState } from 'react';
import { db } from '../db/database';
import type { Workout, WorkoutType } from '../analytics/types';
import { RACE_KM } from '../analytics/predictor';
import { cardiacDrift } from '../analytics/workload';
import { fmtPace } from '../plans/pace';
import { fmtDate, fmtHms } from './format';
import { filterWorkouts, type DistFilter, type SourceFilter, type TypeFilter } from './historyFilter';

const DISTS: DistFilter[] = ['all', '5K', '10K', '21.1K', '42.2K'];
const SOURCES: SourceFilter[] = ['all', 'fit', 'gpx', 'manual'];
const TYPE_LABEL: Record<WorkoutType, string> = { easy: 'Easy', tempo: 'Tempo', interval: 'Interval', long_run: 'Long Run', race: 'Race' };
const TYPE_IDS = Object.keys(TYPE_LABEL) as WorkoutType[];
const field = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-slate-100 focus:border-coral focus:outline-none';
const chip = (on: boolean) =>
  `rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-coral text-navy-900' : 'bg-navy-800 text-slate-300'}`;

export default function Riwayat({ workouts, reload }: { workouts: Workout[]; reload: () => void }) {
  const [q, setQ] = useState('');
  const [dist, setDist] = useState<DistFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [sel, setSel] = useState<Workout | null>(null);
  const sorted = useMemo(() => [...workouts].sort((a, b) => b.date - a.date), [workouts]);
  const list = useMemo(() => filterWorkouts(sorted, { q, dist, source, type }, RACE_KM), [sorted, q, dist, source, type]);

  const remove = async (w: Workout) => {
    if (w.id == null || !confirm('Hapus sesi ini?')) return;
    await db.workouts.delete(w.id);
    setSel(null);
    reload();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Riwayat</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan atau jenis sesi…" className={field} />
      <div className="flex flex-wrap gap-2">
        {DISTS.map((d) => (
          <button key={d} onClick={() => setDist(d)} className={chip(dist === d)}>{d === 'all' ? 'Semua jarak' : d}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(['all', ...TYPE_IDS] as TypeFilter[]).map((t) => (
          <button key={t} onClick={() => setType(t)} className={chip(type === t)}>{t === 'all' ? 'Semua jenis' : TYPE_LABEL[t]}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button key={s} onClick={() => setSource(s)} className={chip(source === s)}>{s === 'all' ? 'Semua sumber' : s.toUpperCase()}</button>
        ))}
      </div>
      {sorted.length === 0 && <p className="text-sm text-slate-400">Belum ada sesi tercatat.</p>}
      {sorted.length > 0 && (
        <p className="text-xs text-slate-400">{list.length} dari {sorted.length} sesi</p>
      )}
      {sorted.length > 0 && list.length === 0 && <p className="text-sm text-slate-400">Tidak ada sesi yang cocok dengan filter.</p>}
      {list.map((w, i) => (
        <button key={w.id ?? i} onClick={() => setSel(w)} className="w-full rounded-xl bg-navy-800 p-3 text-left tabular-nums">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{fmtDate(w.date)}</span>
            <span className="text-xs uppercase text-coral">{TYPE_LABEL[w.workoutType]} · {w.source}</span>
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {w.distanceKm.toFixed(2)} km · {fmtHms(w.durationSec)} · {fmtPace(w.avgPaceSecPerKm)} /km
          </div>
          {w.note && <div className="mt-1 truncate text-xs text-slate-400">{w.note}</div>}
        </button>
      ))}
      {sel && <Detail key={sel.id} w={sel} onClose={() => setSel(null)} onDelete={() => remove(sel)} onSaved={reload} />}
    </div>
  );
}

function Detail({ w, onClose, onDelete, onSaved }: { w: Workout; onClose: () => void; onDelete: () => void; onSaved: () => void }) {
  const [note, setNote] = useState(w.note ?? '');
  const [type, setType] = useState<WorkoutType>(w.workoutType);
  const [saved, setSaved] = useState(false);
  const drift = cardiacDrift(w.laps);
  const stats: [string, string][] = [
    ['Jarak', `${w.distanceKm.toFixed(2)} km`],
    ['Durasi', fmtHms(w.durationSec)],
    ['Pace', `${fmtPace(w.avgPaceSecPerKm)} /km`],
    ['HR rata-rata', w.avgHr ? `${w.avgHr} bpm` : '–'],
    ['HR maks', w.maxHr ? `${w.maxHr} bpm` : '–'],
    ['TRIMP', w.trimp != null ? String(Math.round(w.trimp)) : '–'],
    ['EF', w.efficiencyFactor != null ? w.efficiencyFactor.toFixed(2) : '–'],
    ['Cardiac drift', drift != null ? `${drift.toFixed(1)}%` : '–'],
  ];

  const save = async () => {
    if (w.id == null) return;
    await db.workouts.update(w.id, { note: note.trim(), workoutType: type });
    setSaved(true);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-navy-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{fmtDate(w.date)}</h2>
          <button onClick={onClose} className="text-sm text-slate-400">Tutup</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 tabular-nums">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg bg-navy-800 p-3">
              <div className="text-[11px] uppercase text-slate-400">{k}</div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <label className="mt-4 block text-sm text-slate-300">Jenis sesi
          <select value={type} onChange={(e) => { setType(e.target.value as WorkoutType); setSaved(false); }} className={`${field} mt-1`}>
            {TYPE_IDS.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm text-slate-300">Catatan sesi
          <textarea value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} rows={2} className={`${field} mt-1`} />
        </label>
        <button onClick={save} className="mt-2 w-full rounded-lg bg-coral py-2 font-semibold text-navy-900">Simpan perubahan</button>
        {saved && <p className="mt-1 text-sm text-emerald-400">Tersimpan.</p>}
        {w.laps.length > 0 && (
          <table className="mt-4 w-full text-sm tabular-nums">
            <thead className="text-left text-slate-400"><tr><th className="py-1">km</th><th>Pace</th><th>HR</th></tr></thead>
            <tbody>
              {w.laps.map((l) => (
                <tr key={l.km} className="border-t border-navy-700">
                  <td className="py-1">{l.km}</td><td>{fmtPace(l.paceSec)} /km</td><td>{l.avgHr ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button onClick={onDelete} className="mt-5 w-full rounded-lg border border-red-500 py-2 text-red-400">Hapus sesi</button>
      </div>
    </div>
  );
}
