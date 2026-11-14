import { useState, type ChangeEvent, type FormEvent } from 'react';
import { db } from '../db/database';
import { isDuplicate } from '../db/validate';
import { finalizeWorkout } from '../analytics/workload';
import type { UserProfile, WorkoutType } from '../analytics/types';
import { parseFit } from '../parsers/fitParser';
import { parseGpx } from '../parsers/gpxParser';
import { parseDuration } from '../parsers/manual';
import { todayStr } from './format';

const field = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums text-slate-100 focus:border-coral focus:outline-none';
const TYPES: { id: WorkoutType; label: string }[] = [
  { id: 'easy', label: 'Easy' }, { id: 'tempo', label: 'Tempo' }, { id: 'interval', label: 'Interval' },
  { id: 'long_run', label: 'Long Run' }, { id: 'race', label: 'Race' },
];

interface Msg { text: string; ok: boolean }

export default function QuickLog({ profile, onSaved }: { profile: UserProfile; onSaved: () => void }) {
  const [msg, setMsg] = useState<Msg | null>(null);
  const [impType, setImpType] = useState<WorkoutType>('easy');
  const [impRpe, setImpRpe] = useState('');
  const fail = (text: string) => setMsg({ text, ok: false });

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = /\.fit$/i.test(file.name) ? parseFit(await file.arrayBuffer()) : parseGpx(await file.text());
      const rpe = impRpe === '' ? null : Number(impRpe);
      if (rpe != null && !(rpe >= 1 && rpe <= 10)) return fail('RPE harus 1–10.');
      if (parsed.avgHr == null && rpe == null) {
        return fail('File ini tanpa data HR. Isi RPE (1–10) di atas, lalu pilih berkas lagi agar beban latihan terhitung.');
      }
      if (isDuplicate(await db.workouts.toArray(), parsed)) {
        return fail('Sesi ini sudah ada (waktu dan jarak sama). Impor dilewati.');
      }
      await db.workouts.add(finalizeWorkout({ ...parsed, workoutType: impType, rpe }, profile));
      setMsg({ text: `${parsed.source.toUpperCase()} tersimpan: ${parsed.distanceKm.toFixed(2)} km.`, ok: true });
      onSaved();
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Gagal membaca berkas.');
    } finally {
      input.value = ''; // agar berkas yang sama bisa dipilih lagi
    }
  };

  const onManual = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const day = String(f.get('date'));
    const today = todayStr();
    const durationSec = parseDuration(String(f.get('duration')));
    const distanceKm = Number(f.get('distance'));
    const rpe = Number(f.get('rpe'));
    if (!day || day > today) return fail('Tanggal tidak boleh kosong atau di masa depan.');
    if (durationSec == null || !(distanceKm > 0) || !(rpe >= 1 && rpe <= 10)) {
      return fail('Durasi HH:MM:SS, jarak > 0, RPE 1–10.');
    }
    const date = day === today ? Date.now() : new Date(`${day}T12:00:00`).getTime();
    await db.workouts.add(finalizeWorkout({
      date, source: 'manual', workoutType: String(f.get('type')) as WorkoutType,
      distanceKm, durationSec, avgPaceSecPerKm: durationSec / distanceKm,
      avgHr: null, maxHr: null, avgCadence: null, elevationGain: null, rpe, laps: [],
    }, profile));
    form.reset();
    setMsg({ text: 'Sesi manual tersimpan.', ok: true });
    onSaved();
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Impor sesi (.FIT / .GPX)</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-400">Jenis sesi
            <select value={impType} onChange={(e) => setImpType(e.target.value as WorkoutType)} className={`${field} mt-1`}>
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-400">RPE (wajib bila tanpa HR)
            <input value={impRpe} onChange={(e) => setImpRpe(e.target.value)} type="number" min={1} max={10} placeholder="1–10" className={`${field} mt-1`} />
          </label>
        </div>
        <input type="file" accept=".fit,.gpx" onChange={onImport}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-coral file:px-3 file:py-2 file:font-semibold file:text-navy-900" />
      </section>
      <form onSubmit={onManual} className="space-y-2 rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Catat manual</h2>
        <div className="grid grid-cols-2 gap-2">
          <input name="date" type="date" required defaultValue={todayStr()} max={todayStr()} className={`${field} col-span-2`} />
          <input name="duration" placeholder="HH:MM:SS" required className={field} />
          <input name="distance" type="number" step="0.01" placeholder="km" required className={field} />
          <input name="rpe" type="number" min={1} max={10} placeholder="RPE 1–10" required className={field} />
          <select name="type" className={field}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <button type="submit" className="w-full rounded-lg bg-coral py-2 font-semibold text-navy-900 active:scale-95">Simpan</button>
      </form>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-coral'}`}>{msg.text}</p>}
    </div>
  );
}
