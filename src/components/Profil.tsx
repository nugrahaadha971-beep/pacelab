import { useState, type ChangeEvent, type FormEvent } from 'react';
import { db, exportBackup, importBackup } from '../db/database';
import { tanakaMaxHr } from '../analytics/workload';
import type { RaceDistance, UserProfile } from '../analytics/types';
import { parseDuration } from '../parsers/manual';
import { fmtHms } from './format';

const DISTANCES: RaceDistance[] = ['5K', '10K', '21.1K', '42.2K'];
const field = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums focus:border-coral focus:outline-none';

export default function Profil({ profile, onSaved }: { profile: UserProfile | null; onSaved: () => void }) {
  const [msg, setMsg] = useState('');
  const [auto, setAuto] = useState(true);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const age = Number(f.get('age'));
    const restingHr = Number(f.get('restingHr'));
    const maxHr = auto ? tanakaMaxHr(age) : Number(f.get('maxHr'));
    const targetTimeSec = parseDuration(String(f.get('targetTime')));
    if (!(age > 0) || !(restingHr > 30) || !(maxHr > restingHr) || targetTimeSec == null) {
      setMsg('Periksa usia, Resting HR, Max HR (harus > Resting HR), dan target waktu (HH:MM:SS).');
      return;
    }
    await db.userProfile.put({
      id: 'default', age, restingHr, maxHr,
      targetDistance: f.get('target') as RaceDistance,
      targetRaceDate: Date.parse(String(f.get('raceDate'))) || 0,
      targetTimeSec,
    });
    setMsg('Profil tersimpan.');
    onSaved();
  };

  const exportJson = async () => {
    const url = URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `pacelab-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('Impor akan mengganti seluruh data lokal. Lanjutkan?')) return;
    try {
      await importBackup(await file.text());
      setMsg('Cadangan dipulihkan.');
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gagal mengimpor.');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{profile ? 'Profil & Pengaturan' : 'Atur profil dulu'}</h1>
      <form onSubmit={save} className="space-y-3 rounded-xl bg-navy-800 p-4">
        <label className="block text-sm">Usia
          <input name="age" type="number" required defaultValue={profile?.age} className={field} /></label>
        <label className="block text-sm">Resting HR (bpm)
          <input name="restingHr" type="number" required defaultValue={profile?.restingHr} className={field} /></label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Max HR otomatis (Tanaka)</label>
        <label className="block text-sm">Max HR (bpm)
          <input name="maxHr" type="number" disabled={auto} defaultValue={profile?.maxHr} className={field} /></label>
        <label className="block text-sm">Target lomba
          <select name="target" defaultValue={profile?.targetDistance ?? '10K'} className={field}>
            {DISTANCES.map((d) => <option key={d}>{d}</option>)}
          </select></label>
        <label className="block text-sm">Tanggal lomba
          <input name="raceDate" type="date" className={field}
            defaultValue={profile?.targetRaceDate ? new Date(profile.targetRaceDate).toISOString().slice(0, 10) : ''} /></label>
        <label className="block text-sm">Target waktu (HH:MM:SS)
          <input name="targetTime" required placeholder="03:50:00"
            defaultValue={profile ? fmtHms(profile.targetTimeSec) : ''} className={field} /></label>
        <button type="submit" className="w-full rounded-lg bg-coral py-2 font-semibold text-navy-900 active:scale-95">Simpan profil</button>
      </form>
      <section className="space-y-3 rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Cadangan data</h2>
        <button onClick={exportJson} className="w-full rounded-lg border border-navy-700 py-2">Ekspor JSON</button>
        <input type="file" accept=".json" onChange={importJson}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-3 file:py-2 file:text-slate-100" />
      </section>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
    </div>
  );
}
