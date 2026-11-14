import { useEffect, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import { db } from './db/database';
import { acwr, efTrend, finalizeWorkout, tanakaMaxHr } from './analytics/workload';
import { predictAll, RACE_KM } from './analytics/predictor';
import { parseGpx } from './parsers/gpxParser';
import { parseFit } from './parsers/fitParser';
import { parseDuration } from './parsers/manual';
import TrainingPlan from './components/TrainingPlan';
import CoachCard from './components/CoachCard';
import type { RaceDistance, UserProfile, Workout } from './analytics/types';

const DISTANCES = Object.keys(RACE_KM) as RaceDistance[];
const STATUS_LABEL: Record<string, string> = {
  unknown: '–', undertraining: 'Undertraining', sweet_spot: 'Sweet Spot', high_fatigue: 'High Fatigue',
};
const fmt = (sec: number) => {
  const x = Math.round(sec);
  const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60;
  return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
};

const page: CSSProperties = { maxWidth: 480, margin: '0 auto', padding: 16, minHeight: '100dvh', background: '#0b0f14', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' };
const card: CSSProperties = { background: '#131a22', borderRadius: 12, padding: 12, margin: '12px 0', display: 'grid', gap: 8 };

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [msg, setMsg] = useState('');

  const reload = async () => {
    setProfile((await db.userProfile.get('default')) ?? null);
    setWorkouts(await db.workouts.toArray());
  };
  useEffect(() => { void reload(); }, []);

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const age = Number(f.get('age'));
    const restingHr = Number(f.get('restingHr'));
    const targetTimeSec = parseDuration(String(f.get('targetTime')));
    if (!(age > 0) || !(restingHr > 30) || targetTimeSec == null) {
      setMsg('Periksa usia, Resting HR, dan target waktu (HH:MM:SS).');
      return;
    }
    await db.userProfile.put({
      id: 'default', age, restingHr, maxHr: tanakaMaxHr(age),
      targetDistance: f.get('target') as RaceDistance,
      targetRaceDate: Date.parse(String(f.get('raceDate'))) || 0,
      targetTimeSec,
    });
    setMsg('Profil tersimpan.');
    void reload();
  };

  const saveManual = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!profile) return;
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
    void reload();
  };

  const onGpx = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const parsed = /\.fit$/i.test(file.name) ? parseFit(await file.arrayBuffer()) : parseGpx(await file.text());
      await db.workouts.add(finalizeWorkout({ ...parsed, workoutType: 'easy', rpe: null }, profile));
      setMsg(`${parsed.source.toUpperCase()} tersimpan: ${parsed.distanceKm.toFixed(2)} km.`);
      void reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Gagal membaca GPX.');
    }
  };

  if (profile === undefined) return <p style={page}>Memuat…</p>;

  if (profile === null) {
    return (
      <main style={page}>
        <h1>PACELAB</h1>
        <p>Atur profil dulu.</p>
        <form onSubmit={saveProfile} style={card}>
          <label>Usia <input name="age" type="number" required /></label>
          <label>Resting HR <input name="restingHr" type="number" required /></label>
          <label>Target lomba <select name="target">{DISTANCES.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Tanggal lomba <input name="raceDate" type="date" /></label>
          <label>Target waktu (HH:MM:SS) <input name="targetTime" placeholder="03:50:00" required /></label>
          <button type="submit">Simpan profil</button>
        </form>
        <p>{msg}</p>
      </main>
    );
  }

  const t = Date.now();
  const load = acwr(workouts, profile, t);
  const ef = efTrend(workouts, t);
  const pred = predictAll(workouts, t);
  const rows = DISTANCES.map((d) => ({ d, p: pred[d] }));

  return (
    <main style={page}>
      <h1>PACELAB</h1>
      <section style={card}>
        <strong>Beban (ACWR)</strong>
        <span>{load.ratio == null ? 'Data belum cukup' : `${load.ratio.toFixed(2)} · ${STATUS_LABEL[load.status]}`}</span>
      </section>
      <section style={card}>
        <strong>Efisiensi Aerobik (14 hari)</strong>
        <span>
          {ef.changePct == null ? 'Data belum cukup' : `${ef.changePct.toFixed(1)}%${ef.improving ? ' · Kapasitas Aerobik Meningkat' : ''}`}
        </span>
      </section>
      <section style={card}>
        <strong>Prediksi Lomba</strong>
        {rows.map(({ d, p }) => (
          <span key={d}>{d}: {p ? fmt(p.finalSec) : '–'}</span>
        ))}
      </section>
      <CoachCard workouts={workouts} profile={profile} />
      <TrainingPlan />
      <section style={card}>
        <strong>Input sesi manual</strong>
        <form onSubmit={saveManual} style={{ display: 'grid', gap: 8 }}>
          <input name="duration" placeholder="Durasi HH:MM:SS" required />
          <input name="distance" type="number" step="0.01" placeholder="Jarak (km)" required />
          <input name="rpe" type="number" min={1} max={10} placeholder="RPE 1–10" required />
          <select name="type">
            <option value="easy">Easy Run</option>
            <option value="tempo">Tempo Run</option>
            <option value="interval">Interval</option>
            <option value="long_run">Long Run</option>
            <option value="race">Race</option>
          </select>
          <button type="submit">Simpan</button>
        </form>
        <label>Impor GPX / FIT <input type="file" accept=".gpx,.fit" onChange={onGpx} /></label>
      </section>
      <p>{msg}</p>
    </main>
  );
}
