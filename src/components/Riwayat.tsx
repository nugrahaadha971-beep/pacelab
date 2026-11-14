import { useState } from 'react';
import { db } from '../db/database';
import type { Workout } from '../analytics/types';
import { cardiacDrift } from '../analytics/workload';
import { fmtPace } from '../plans/pace';
import { fmtDate, fmtHms } from './format';

export default function Riwayat({ workouts, reload }: { workouts: Workout[]; reload: () => void }) {
  const [sel, setSel] = useState<Workout | null>(null);
  const list = [...workouts].sort((a, b) => b.date - a.date);

  const remove = async (w: Workout) => {
    if (w.id == null || !confirm('Hapus sesi ini?')) return;
    await db.workouts.delete(w.id);
    setSel(null);
    reload();
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Riwayat</h1>
      {list.length === 0 && <p className="text-sm text-slate-400">Belum ada sesi.</p>}
      {list.map((w, i) => (
        <button key={w.id ?? i} onClick={() => setSel(w)} className="w-full rounded-xl bg-navy-800 p-3 text-left tabular-nums">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{fmtDate(w.date)}</span>
            <span className="text-xs uppercase text-coral">{w.workoutType.replace('_', ' ')} · {w.source}</span>
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {w.distanceKm.toFixed(2)} km · {fmtHms(w.durationSec)} · {fmtPace(w.avgPaceSecPerKm)} /km
          </div>
        </button>
      ))}
      {sel && <Detail w={sel} onClose={() => setSel(null)} onDelete={() => remove(sel)} />}
    </div>
  );
}

function Detail({ w, onClose, onDelete }: { w: Workout; onClose: () => void; onDelete: () => void }) {
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
