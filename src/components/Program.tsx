import { useState } from 'react';
import type { RaceDistance, UserProfile, Workout } from '../analytics/types';
import { db } from '../db/database';
import { currentVdot, PENALTY_RULES, penaltyPct, predictAll, RACE_KM, velocityFor, ZONE_FRACTION } from '../analytics/predictor';
import { fmtPace } from '../plans/pace';
import { pbOutlook } from '../plans/adaptiveEngine';
import { isoFromRaceTs, isValidIso, remaining } from '../plans/schedule';
import { PLAN_LABEL, resolvePlan, selectBestPlan } from '../plans/planSelector';
import type { PlanMode } from '../plans/planSelector';
import { loadPlanMode, savePlanMode } from '../plans/scheduleStore';
import { DAY_MS } from '../analytics/workload';
import { fmtHms, todayStr } from './format';
import TrainingPlan from './TrainingPlan';

type Zone = keyof typeof ZONE_FRACTION;
const card = 'rounded-xl bg-navy-800 p-4';
const field = 'mt-1 w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums text-slate-100 focus:border-coral focus:outline-none';
const ZONE_NAME: Record<Zone, string> = { easy: 'Easy', marathon: 'Marathon', threshold: 'Threshold', interval: 'Interval' };

function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <div className="mt-1 h-2 rounded bg-navy-900">
      <div className="h-2 rounded bg-coral" style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }} />
    </div>
  );
}

export default function Program({ profile, workouts, onProfileChange }: { profile: UserProfile; workouts: Workout[]; onProfileChange: () => void }) {
  const now = Date.now();
  const raceIso = profile.targetRaceDate ? isoFromRaceTs(profile.targetRaceDate) : null;
  const [raceText, setRaceText] = useState(raceIso ?? '');
  const [mode, setMode] = useState<PlanMode>(loadPlanMode);
  const chooseMode = (m: PlanMode) => { setMode(m); savePlanMode(m); };
  const saveRaceDate = async (v: string) => {
    setRaceText(v);
    if (v !== '' && !isValidIso(v)) return;
    await db.userProfile.put({ ...profile, targetRaceDate: v ? Date.parse(v) : 0 });
    onProfileChange();
  };
  const target: RaceDistance = profile.targetDistance;
  const rem = raceIso ? remaining(raceIso, todayStr()) : null;
  const daysLeft = rem ? rem.daysRemaining : null;
  const goalPace = profile.targetTimeSec / RACE_KM[target];
  const preds = predictAll(workouts, now);
  const pred = preds[target];
  const gap = pred ? pred.finalSec - profile.targetTimeSec : null;
  const outlook = pred ? pbOutlook(pred.finalSec, profile.targetTimeSec, rem?.weeksRemaining ?? 0) : null;
  const currentPace = pred ? pred.finalSec / RACE_KM[target] : null;
  const rule = PENALTY_RULES[target];
  const last28 = workouts.filter((w) => w.date <= now && now - w.date <= 28 * DAY_MS);
  const weeklyKm = last28.reduce((s, w) => s + w.distanceKm, 0) / 4;
  const longRun = last28.filter((w) => w.workoutType === 'long_run').reduce((m, w) => Math.max(m, w.distanceKm), 0);
  const pen = penaltyPct(target, workouts, now);
  const penMin = pred ? (pred.finalSec - pred.baseSec) / 60 : 0;
  const vd = currentVdot(workouts, now);
  const zones = Object.keys(ZONE_FRACTION) as Zone[];
  const easyPace = vd != null ? 60000 / velocityFor(vd, ZONE_FRACTION.easy) : 360;
  const selection = selectBestPlan(workouts, profile, { now, projected5kSec: preds['5K']?.finalSec ?? null });
  const curriculum = resolvePlan(mode, selection);
  const MODE_PILLS: Array<[PlanMode, string]> = [['auto', 'Otomatis'], ['progressive5k', 'Progresif 5K'], ['nike5k', 'Nike 5K']];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Program</h1>

      <label className={`${card} block text-sm`}>Tanggal lomba <span className="text-xs text-slate-400">(sinkron dengan Profil)</span>
        <input type="date" value={raceText} onChange={(e) => void saveRaceDate(e.target.value)} className={field} />
      </label>

      <section className={card} aria-label="Rekomendasi Pelatih">
        <div className="text-[11px] uppercase text-slate-400">Rekomendasi Pelatih untuk Kondisi Anda</div>
        <div className="mt-1 font-semibold text-coral">
          {mode === 'auto' ? 'Otomatis' : 'Pilihan Anda'}: {PLAN_LABEL[curriculum]}
        </div>
        {mode !== 'auto' && curriculum !== selection.plan && (
          <p className="mt-1 text-xs text-amber-400">Rekomendasi otomatis untuk kondisi Anda saat ini: {PLAN_LABEL[selection.plan]}.</p>
        )}
        <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Pilih kurikulum">
          {MODE_PILLS.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => chooseMode(m)}
              className={`rounded-full px-2 py-2 text-xs font-semibold ${mode === m ? 'bg-coral text-navy-900' : 'border border-navy-700 text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {selection.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        {target !== '5K' && <p className="mt-2 text-xs text-slate-400">Kedua kurikulum ini untuk 5K, sedangkan jarak target Anda {target}.</p>}
      </section>

      <section className={card}>
        <div className="text-xs uppercase tracking-wide text-slate-400">Hitung mundur · {target}</div>
        <div className="mt-1 text-4xl font-bold tabular-nums text-coral">{daysLeft == null ? '–' : Math.max(0, daysLeft)}</div>
        <div className="text-sm text-slate-400">
          {daysLeft == null ? 'Isi tanggal lomba di atas' : daysLeft < 0 ? 'Lomba sudah lewat' : `hari lagi · ${rem?.weeksRemaining} minggu`}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm tabular-nums">
          <div>Target waktu<div className="font-semibold">{fmtHms(profile.targetTimeSec)}</div></div>
          <div>Pace dibutuhkan<div className="font-semibold">{fmtPace(goalPace)} /km</div></div>
          <div>Prediksi saat ini<div className="font-semibold">{pred ? fmtHms(pred.finalSec) : '–'}</div></div>
          <div>Selisih<div className="font-semibold">{gap == null ? '–' : gap > 0 ? `+${fmtHms(gap)}` : `−${fmtHms(-gap)}`}</div></div>
        </div>
        {outlook && currentPace != null && (
          <div className="mt-3 rounded-lg bg-navy-900 p-3 text-sm tabular-nums">
            <div className="text-[11px] uppercase text-slate-400">Peluang pecah PB</div>
            <div className="font-semibold text-coral">{outlook.label}</div>
            <div className="mt-1 text-slate-300">
              Gap waktu: {outlook.gapSec > 0 ? `+${Math.round(outlook.gapSec)} dtk (${fmtHms(outlook.gapSec)})` : `${Math.round(outlook.gapSec)} dtk, sudah di bawah target`}
            </div>
            <div className="text-slate-300">Pace: {fmtPace(currentPace)} → {fmtPace(goalPace)} /km</div>
            {outlook.perWeekSec != null && <div className="text-slate-300">Perlu ≈ {outlook.perWeekSec.toFixed(1)} dtk perbaikan/minggu</div>}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-300">Volume & long run</h2>
        <div className="mt-2 text-sm tabular-nums">
          Rata-rata 4 minggu: <span className="font-semibold">{weeklyKm.toFixed(1)} km/minggu</span>
        </div>
        {rule && (
          <>
            <div className="mt-2 text-xs text-slate-400">Syarat {target}: {rule.weeklyKm} km/minggu</div>
            <ProgressBar ratio={weeklyKm / rule.weeklyKm} />
          </>
        )}
        {profile.weeklyTargetKm != null && (
          <>
            <div className="mt-2 text-xs text-slate-400">Target mingguan Anda: {profile.weeklyTargetKm} km</div>
            <ProgressBar ratio={weeklyKm / profile.weeklyTargetKm} />
          </>
        )}
        {rule && (
          <>
            <div className="mt-3 text-sm tabular-nums">
              Long run terpanjang: <span className="font-semibold">{longRun.toFixed(1)} km</span>{' '}
              <span className="text-slate-400">/ syarat {rule.longRunKm} km</span>
            </div>
            <ProgressBar ratio={longRun / rule.longRunKm} />
          </>
        )}
        {pen > 0 ? (
          <div className="mt-4 rounded-lg border border-coral/60 bg-coral/10 p-3 text-sm text-coral">
            Penalti daya tahan aktif: +{(pen * 100).toFixed(1)}% (≈ +{penMin.toFixed(0)} menit). Volume atau long run di bawah syarat.
          </div>
        ) : rule ? (
          <div className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-400">Syarat volume dan long run terpenuhi.</div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">Tidak ada penalti daya tahan untuk {target}.</div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-300">Zona pace · VDOT {vd == null ? '–' : vd.toFixed(1)}</h2>
        {vd == null ? (
          <p className="mt-2 text-sm text-slate-400">Butuh sesi ≥ 3 km dalam 42 hari terakhir.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 tabular-nums">
            {zones.map((z) => (
              <div key={z} className="rounded-lg bg-navy-900 p-3">
                <div className="text-[11px] uppercase text-slate-400">{ZONE_NAME[z]}</div>
                <div className="font-semibold">{fmtPace(60000 / velocityFor(vd, ZONE_FRACTION[z]))} /km</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <TrainingPlan profile={profile} workouts={workouts} defaultK5Sec={preds['5K']?.finalSec ?? null} currentPaceSecPerKm={currentPace} startWeeklyKm={weeklyKm} easyPaceSecPerKm={easyPace} curriculum={curriculum} />
    </div>
  );
}
