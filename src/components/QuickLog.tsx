import { useState, type ChangeEvent, type FormEvent } from 'react';
import { db } from '../db/database';
import { finalizeWorkout } from '../analytics/workload';
import type { UserProfile, Workout } from '../analytics/types';
import { parseFit } from '../parsers/fitParser';
import { parseGpx } from '../parsers/gpxParser';
import { parseDuration } from '../parsers/manual';

const field = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums focus:border-coral focus:outline-none';

export default function QuickLog({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const [msg, setMsg] = useState('');

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = /\.fit$/i.test(file.name) ? parseFit(await file.arrayBuffer()) : parseGpx(await file.text());
      await db.workouts.add(finalizeWorkout({ ...parsed, workoutType: 'easy', rpe: null }, profile));
      setMsg(`${parsed.source.toUpperCase()} tersimpan: ${parsed.distanceKm.toFixed(2)} km.`);
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gagal membaca berkas.');
    }
  };

  const onManual = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const durationSec = parseDuration(String(f.get('duration')));
    const distanceKm = Number(f.get('distance'));
    const rpe = Number(f.get('rpe'));
    if (durationSec == null || !(distanceKm > 0) || !(rpe >= 1 && rpe <= 10)) {
      setMsg('Durasi HH:MM:SS, jarak > 0, RPE 1–10.');
      return;
    }
    await db.workouts.add(finalizeWorkout({
      date: Date.now(), source: 'manual', workoutType: String(f.get('type')) as Workout['workoutType'],
      distanceKm, durationSec, avgPaceSecPerKm: durationSec / distanceKm,
      avgHr: null, maxHr: null, avgCadence: null, elevationGain: null, rpe, laps: [],
    }, profile));
    form.reset();
    setMsg('Sesi manual tersimpan.');
    onSaved();
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Impor sesi (.FIT / .GPX)</h2>
        <input type="file" accept=".fit,.gpx" onChange={onImport}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-coral file:px-3 file:py-2 file:font-semibold file:text-navy-900" />
      </section>
      <form onSubmit={onManual} className="space-y-2 rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Catat manual</h2>
        <div className="grid grid-cols-2 gap-2">
          <input name="duration" placeholder="HH:MM:SS" required className={field} />
          <input name="distance" type="number" step="0.01" placeholder="km" required className={field} />
          <input name="rpe" type="number" min={1} max={10} placeholder="RPE 1–10" required className={field} />
          <select name="type" className={field}>
            <option value="easy">Easy</option><option value="tempo">Tempo</option><option value="interval">Interval</option>
            <option value="long_run">Long Run</option><option value="race">Race</option>
          </select>
        </div>
        <button type="submit" className="w-full rounded-lg bg-coral py-2 font-semibold text-navy-900 active:scale-95">Simpan</button>
      </form>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
    </div>
  );
}
