import { useState, type ChangeEvent, type FormEvent } from 'react';
import { clearAll, db, exportBackup, importBackup } from '../db/database';
import { tanakaMaxHr } from '../analytics/workload';
import type { RaceDistance, UserProfile } from '../analytics/types';
import { parseDuration } from '../parsers/manual';
import { fmtHms } from './format';

const DISTANCES: RaceDistance[] = ['5K', '10K', '21.1K', '42.2K'];
const field = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums text-slate-100 focus:border-coral focus:outline-none disabled:opacity-60';

interface Msg { text: string; ok: boolean }

export default function Profil({ profile, onSaved }: { profile: UserProfile | null; onSaved: () => void }) {
  const [msg, setMsg] = useState<Msg | null>(null);
  const [age, setAge] = useState(profile?.age ?? 0);
  // Otomatis hanya bila profil baru, atau Max HR tersimpan memang sama dengan hasil Tanaka.
  const [auto, setAuto] = useState(() => !profile || profile.maxHr === tanakaMaxHr(profile.age));
  const [maxHrText, setMaxHrText] = useState(String(profile?.maxHr ?? ''));
  const fail = (text: string) => setMsg({ text, ok: false });

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const restingHr = Number(f.get('restingHr'));
    const maxHr = auto ? tanakaMaxHr(age) : Number(maxHrText);
    const targetTimeSec = parseDuration(String(f.get('targetTime')));
    if (!(age > 0) || !(restingHr > 30) || !(maxHr > restingHr) || targetTimeSec == null) {
      return fail('Periksa usia, Resting HR, Max HR (harus > Resting HR), dan target waktu (HH:MM:SS).');
    }
    await db.userProfile.put({
      id: 'default', age, restingHr, maxHr,
      targetDistance: f.get('target') as RaceDistance,
      targetRaceDate: Date.parse(String(f.get('raceDate'))) || 0,
      targetTimeSec,
      weeklyTargetKm: Number(f.get('weeklyTargetKm')) || undefined,
    });
    setMsg({ text: 'Profil tersimpan.', ok: true });
    onSaved();
  };

  const exportJson = async () => {
    const url = URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `pacelab-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (!confirm('Impor akan mengganti seluruh sesi lokal. Lanjutkan?')) return;
      const r = await importBackup(await file.text());
      const parts = [`${r.workouts} sesi dipulihkan`];
      if (r.skipped) parts.push(`${r.skipped} dilewati karena data rusak`);
      if (r.profile) parts.push('profil dipulihkan');
      if (r.schedule) parts.push('jadwal latihan dipulihkan');
      setMsg({ text: parts.join(', ') + '.', ok: true });
      onSaved();
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Gagal mengimpor.');
    } finally {
      input.value = '';
    }
  };

  const wipe = async () => {
    if (!confirm('Hapus SEMUA data lokal (sesi dan profil)? Ekspor cadangan dulu bila perlu. Tindakan ini tidak bisa dibatalkan.')) return;
    await clearAll();
    onSaved();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{profile ? 'Profil & Pengaturan' : 'Atur profil dulu'}</h1>
      <form onSubmit={save} className="space-y-3 rounded-xl bg-navy-800 p-4">
        <label className="block text-sm">Usia
          <input type="number" required value={age || ''} onChange={(e) => setAge(Number(e.target.value))} className={field} /></label>
        <label className="block text-sm">Resting HR (bpm)
          <input name="restingHr" type="number" required defaultValue={profile?.restingHr} className={field} /></label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Max HR otomatis (Tanaka)</label>
        <label className="block text-sm">Max HR (bpm)
          <input type="number" disabled={auto}
            value={auto ? (age > 0 ? String(tanakaMaxHr(age)) : '') : maxHrText}
            onChange={(e) => setMaxHrText(e.target.value)} className={field} /></label>
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
        <label className="block text-sm">Target jarak mingguan (km)
          <input name="weeklyTargetKm" type="number" step="0.5" defaultValue={profile?.weeklyTargetKm} className={field} /></label>
        <button type="submit" className="w-full rounded-lg bg-coral py-2 font-semibold text-navy-900 active:scale-95">Simpan profil</button>
      </form>
      <section className="space-y-3 rounded-xl bg-navy-800 p-4">
        <h2 className="text-sm font-semibold text-slate-300">Cadangan data</h2>
        <p className="text-xs text-slate-400">Cadangan berisi seluruh sesi dan profil. Data hanya tersimpan di perangkat ini.</p>
        <button onClick={exportJson} className="w-full rounded-lg border border-navy-700 py-2">Ekspor JSON</button>
        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-navy-700 py-3 text-sm text-slate-300 hover:border-coral">
          Pilih berkas cadangan (.json)
          <input type="file" accept=".json" onChange={importJson} className="hidden" />
        </label>
        {profile && (
          <button onClick={wipe} className="w-full rounded-lg border border-red-500 py-2 text-red-400">Hapus semua data lokal</button>
        )}
      </section>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-coral'}`}>{msg.text}</p>}
    </div>
  );
}
