import { useState } from 'react';
import type { UserProfile, Workout } from '../analytics/types';
import { PENALTY_RULES, RACE_KM } from '../analytics/predictor';
import { applyAdaptation, evaluateAdaptation, gatherAdaptiveInput, weekPace } from '../plans/adaptiveEngine';
import { fmtKm, fmtPace, fmtRangeKm, nearestRow, paceKeyFor, paceSecPerKm } from '../plans/pace';
import {
  addDays, applyScheduleState, autoCompleted, buildPlan, completedIds, dayNum, flattenPlan, formatDateId, formatDayMonth,
  isoFromLocal, isoFromRaceTs, MIN_BASE_WEEKLY_KM, MIN_TRAINING_DAYS, resetSchedule, setSessionDate, shiftAll, swapSessions, toggleDay, toggleDone,
  WEEKDAY_SHORT,
} from '../plans/schedule';
import type { Phase, PlanSession, ScheduleState } from '../plans/schedule';
import { loadScheduleState, saveScheduleState } from '../plans/scheduleStore';
import { parseDuration } from '../parsers/manual';
import { fmtDate, fmtHms, todayStr } from './format';

const KIND_LABEL: Record<PlanSession['kind'], string> = { recovery: 'Easy / Recovery Run', speed: 'Speed Run', long: 'Long Run', race: 'Hari Lomba' };
const KIND_HINT: Record<PlanSession['kind'], string> = {
  recovery: 'Lari santai: napas tenang, masih bisa ngobrol. Jangan dipercepat walau terasa terlalu mudah.',
  long: 'Lari terpanjang minggu ini. Pace santai, sama seperti Easy Run. Boleh jeda jalan kaki bila perlu.',
  speed: 'Lari cepat berinterval. Ikuti pace tiap langkah; sela pemulihan dilakukan dengan lari/jalan pelan.',
  race: 'Hari uji PB: lari dengan target pace PB di bawah.',
};
const PHASE_LABEL: Record<Phase, string> = { base: 'Base Building', build: 'Build', taper: 'Taper', race: 'Lomba' };
const STORE_KEY = 'pacelab.k5';
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Sen … Min
const card = 'my-3 grid gap-2 rounded-xl bg-navy-800 p-4';
const input = 'w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 tabular-nums text-slate-100 focus:border-coral focus:outline-none';
const btn = 'rounded-lg border border-navy-700 px-3 py-2 text-sm active:scale-95';
const badge = 'inline-block rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-semibold text-coral';

function loadSaved(): string | null {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}

interface Props {
  profile: UserProfile;
  workouts: Workout[];
  defaultK5Sec: number | null;
  /** Pace proyeksi Riegel saat ini untuk jarak target (detik/km); null bila belum ada data. */
  currentPaceSecPerKm: number | null;
  startWeeklyKm: number;
  easyPaceSecPerKm: number;
}

export default function TrainingPlan({ profile, workouts, defaultK5Sec, currentPaceSecPerKm, startWeeklyKm, easyPaceSecPerKm }: Props) {
  const [st, setSt] = useState<ScheduleState>(loadScheduleState);
  const [weekIdx, setWeekIdx] = useState(0);
  const [k5Text, setK5Text] = useState(() => loadSaved() ?? (defaultK5Sec != null ? fmtHms(defaultK5Sec) : ''));
  const [fromPrediction, setFromPrediction] = useState(() => loadSaved() == null && defaultK5Sec != null);
  const k5 = parseDuration(k5Text);
  const row = k5 != null ? nearestRow(k5) : null;

  const update = (next: ScheduleState) => { setSt(next); saveScheduleState(next); };
  const onK5 = (v: string) => {
    setK5Text(v);
    setFromPrediction(false);
    try { localStorage.setItem(STORE_KEY, v); } catch { /* penyimpanan tidak tersedia: abaikan */ }
  };

  const todayIso = todayStr();
  const raceIso = profile.targetRaceDate ? isoFromRaceTs(profile.targetRaceDate) : null;
  const targetPace = profile.targetTimeSec / RACE_KM[profile.targetDistance];
  const maxWeeklyKm = profile.weeklyTargetKm ?? PENALTY_RULES[profile.targetDistance]?.weeklyKm ?? 50;

  const header = (
    <>
      <strong>Rencana Latihan · menuju PB {profile.targetDistance}</strong>
      <label className="text-sm text-slate-300">5K terbaru Anda (MM:SS) · dasar pace chart
        <input value={k5Text} onChange={(e) => onK5(e.target.value)} placeholder="27:00" className={`${input} mt-1`} />
      </label>
      {fromPrediction && <span className="text-xs text-slate-400">Terisi dari prediksi Riegel Anda. Ubah bila punya hasil 5K terbaru.</span>}
      {k5Text && k5 == null && <span className="text-sm text-coral">Format waktu tidak valid.</span>}
      {row && <span className="text-sm tabular-nums">Baris Pace Chart: 5K {fmtPace(row[1])} · pace tercepat {fmtKm(row[0] / 1.609344)}</span>}
    </>
  );

  if (!raceIso) {
    return (
      <section className={card}>
        {header}
        <span className="rounded-lg border border-dashed border-coral/60 bg-coral/10 p-3 text-sm">Isi tanggal lomba di bagian atas tab ini untuk membuat jadwal berdasarkan kalender nyata.</span>
      </section>
    );
  }

  // Satu sumber pace santai: Pace Chart (kolom recovery) bila ada, jika tidak zona Easy VDOT.
  const easyPace = paceSecPerKm('rec', row) ?? easyPaceSecPerKm;
  const basePlan = buildPlan({
    raceIso, todayIso, days: st.days, raceName: `${profile.targetDistance} · Hari Lomba / Uji PB`,
    startWeeklyKm, maxWeeklyKm, easyPaceSecPerKm: easyPace,
  });
  const plan = applyScheduleState(basePlan, st, raceIso);
  const flat = flattenPlan(plan);
  const workoutDays = new Set(workouts.map((w) => isoFromLocal(w.date)));
  const done = completedIds(flat, workoutDays, st, todayIso);

  const gathered = gatherAdaptiveInput(workouts, profile, Date.now());
  const decision = evaluateAdaptation(gathered.input);
  const adapted = applyAdaptation(flat, decision, todayIso, done);
  const byId = new Map(adapted.sessions.map((s) => [s.id, s]));
  const labelOf = (id: string) => { const s = byId.get(id); return s ? `${formatDayMonth(s.date)} · ${KIND_LABEL[s.kind]}` : id; };

  const missed = flat.filter((s) => dayNum(s.date) < dayNum(todayIso) && !done.has(s.id)).length;
  const wi = Math.min(weekIdx, Math.max(0, plan.weeks.length - 1));
  const week = plan.weeks[wi];
  const goalPaceFor = (s: PlanSession): number | null =>
    s.kind === 'race' ? targetPace : currentPaceSecPerKm == null ? null : weekPace(currentPaceSecPerKm, targetPace, s.weekNo, plan.totalWeeks);
  const weekLabel = (w: (typeof plan.weeks)[number]) =>
    `Minggu ${w.weekNo}/${plan.totalWeeks} · ${formatDayMonth(dayNum(w.startIso) < dayNum(todayIso) ? todayIso : w.startIso)}–${formatDayMonth(w.endIso)} · ${PHASE_LABEL[w.phase]}`;

  if (!week) {
    return <section className={card}>{header}<span className="text-sm text-slate-300">Tanggal lomba sudah lewat. Atur tanggal lomba baru di bagian atas tab ini.</span></section>;
  }

  const { last } = gathered;
  const lastIn = gathered.input;
  /** Durasi & jarak yang ditampilkan (sudah memperhitungkan penyesuaian adaptif). */
  const loadOf = (s: PlanSession): { min: number | null; km: number | null } => {
    const min = s.adjDurationMin ?? s.durationMin;
    if (min == null || s.kind === 'speed' || s.kind === 'race') return { min, km: null };
    const km = s.distanceKm != null && s.durationMin ? (s.distanceKm * min) / s.durationMin : (min * 60) / easyPace;
    return { min, km };
  };
  const weekKm = week.sessions.reduce((sum, r) => sum + (loadOf(byId.get(r.id) as PlanSession).km ?? 0), 0);

  return (
    <section className={card}>
      {header}
      <span className="text-sm tabular-nums text-slate-300">
        {plan.daysRemaining} hari · {plan.weeksRemaining} minggu menuju {formatDateId(raceIso)}
        {plan.baseWeeks > 0 ? ` · ${plan.baseWeeks} minggu Base Building + blok puncak 8 minggu` : ''}
      </span>

      <details className="rounded-lg bg-navy-900 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-300">Apa itu Easy, Recovery, dan Long Run?</summary>
        <div className="mt-2 space-y-2 text-slate-300">
          <p><strong>Easy Run / Recovery Run</strong>: lari santai. Pace pelan, napas tenang, masih bisa ngobrol kalimat utuh. Fungsinya membangun daya tahan dan memulihkan kaki. Easy dan Recovery sama-sama santai, hanya beda tujuan; pace yang dipakai sama.</p>
          <p><strong>Long Run</strong>: lari paling panjang dalam seminggu, tetap pace santai. Yang dilatih daya tahan, bukan kecepatan.</p>
          <p><strong>Speed Run</strong>: sesi cepat (interval/tempo). Ada pemanasan, bagian cepat dengan pace tertentu, lalu pemulihan pelan.</p>
          <p className="text-xs text-slate-400">Setiap kartu menampilkan jarak (km) dan pace dalam menit per km. Pace santai ditampilkan sebagai rentang; lebih lambat sedikit tidak masalah, jangan lebih cepat.</p>
        </div>
      </details>

      <div className="rounded-lg border border-coral/40 bg-coral/5 p-3 text-sm">
        <div className="font-semibold">Penyesuaian Terbaru dari Sesi Terakhir</div>
        {!last ? (
          <p className="mt-1 text-slate-400">Belum ada sesi tercatat. Penyesuaian otomatis aktif setelah Anda mencatat latihan.</p>
        ) : (
          <>
            <p className="mt-1 text-xs tabular-nums text-slate-400">
              {fmtDate(last.date)} · ACWR {lastIn.acwrRatio == null ? '–' : lastIn.acwrRatio.toFixed(2)}
              {' · '}EF {decision.efGainPct == null ? '–' : `${decision.efGainPct >= 0 ? '+' : ''}${decision.efGainPct.toFixed(1)}% vs rata-rata 14 hari`}
              {' · '}Drift {lastIn.lastDriftPct == null ? '–' : `${lastIn.lastDriftPct.toFixed(1)}%`}
            </p>
            {adapted.notes.length === 0 ? (
              <p className="mt-2 text-slate-300">Tidak ada penyesuaian: beban, efisiensi, dan drift dalam batas normal.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {adapted.notes.map((n, i) => (
                  <li key={i}>
                    <span className={badge}>{n.badge}</span>{' '}
                    <span className="text-xs text-slate-400">{labelOf(n.sessionId)}</span>
                    <div className="text-slate-200">{n.reason}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="text-sm text-slate-300">Hari Latihan Rutin (min. {MIN_TRAINING_DAYS} hari)</div>
      <div className="grid grid-cols-7 gap-1">
        {DAY_ORDER.map((d) => {
          const on = st.days.includes(d);
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => update(toggleDay(st, d))}
              className={`rounded-lg py-2 text-xs font-semibold ${on ? 'bg-coral text-navy-900' : 'border border-navy-700 text-slate-300'}`}>
              {WEEKDAY_SHORT[d]}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-navy-900 p-3">
        <div className="text-sm font-semibold text-slate-300">Adjust Jadwal</div>
        {missed > 0 && <p className="mt-1 text-xs text-amber-400">{missed} sesi terlewat. Geser jadwal bila ingin mengejar.</p>}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" className={btn} onClick={() => update(shiftAll(st, -1))}>−1 hari</button>
          <button type="button" className={btn} onClick={() => update(shiftAll(st, 1))}>+1 hari</button>
          <button type="button" className={btn} onClick={() => { if (confirm('Reset jadwal ke hasil penjadwalan otomatis? Geseran dan tanggal manual dihapus.')) update(resetSchedule(st)); }}>Reset</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Geser aktif: {st.shift > 0 ? `+${st.shift}` : st.shift} hari · {Object.keys(st.overrides).length} tanggal manual. Hari lomba tidak ikut bergeser.
        </p>
      </div>

      <select value={wi} onChange={(e) => setWeekIdx(Number(e.target.value))} aria-label="Pilih minggu"
        className="w-full rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-slate-100">
        {plan.weeks.map((w, i) => <option key={w.weekNo} value={i}>{weekLabel(w)}</option>)}
      </select>
      {week.plannedKm != null && (
        <span className="text-xs text-slate-400">
          Target volume Base minggu ini: {week.plannedKm} km (naik maks +10%/minggu).
          {startWeeklyKm < MIN_BASE_WEEKLY_KM ? ` Data 28 hari terakhir hanya ${startWeeklyKm.toFixed(1)} km/minggu, jadi volume awal dipatok minimal ${MIN_BASE_WEEKLY_KM} km. Kurangi hari latihan bila terasa berat.` : ''}
        </span>
      )}
      {weekKm > 0 && <span className="text-sm tabular-nums text-slate-300">Total jarak lari santai + long run minggu ini: <strong>≈{weekKm.toFixed(1)} km</strong>{week.sessions.some((x) => x.kind === 'speed') ? ' (belum termasuk sesi Speed)' : ''}</span>}

      {week.sessions.map((raw) => {
        const s = byId.get(raw.id) as PlanSession;
        const isDone = done.has(s.id);
        const auto = autoCompleted(s, workoutDays, todayIso);
        const gp = goalPaceFor(s);
        const status = isDone ? 'Selesai' : dayNum(s.date) < dayNum(todayIso) ? 'Terlewat' : s.date === todayIso ? 'Hari ini' : 'Mendatang';
        const statusColor = isDone ? 'text-emerald-400' : status === 'Terlewat' ? 'text-amber-400' : status === 'Hari ini' ? 'text-coral' : 'text-slate-400';
        const delta = s.paceDeltaSec ?? 0;
        const easy = s.kind === 'recovery' || s.kind === 'long';
        const { min, km } = loadOf(s);
        const showName = s.name && s.kind !== 'race' && !['Easy Run', 'Long Run'].includes(s.name);
        const swapChoices = week.sessions.filter((o) => o.id !== s.id && o.kind !== 'race' && !done.has(o.id)).map((o) => byId.get(o.id) as PlanSession);
        return (
          <div key={s.id} className="border-t border-navy-700 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold tabular-nums">{formatDateId(s.date)}</span>
              <label className={`flex items-center gap-1 text-xs ${statusColor}`}>
                <input type="checkbox" checked={isDone} disabled={auto} onChange={() => update(toggleDone(st, s.id))} aria-label={`Tandai selesai: ${KIND_LABEL[s.kind]}`} />
                {status}{auto ? ' (otomatis)' : ''}
              </label>
            </div>
            <strong>{s.convertedFrom ? s.name : `${KIND_LABEL[s.kind]}${showName ? ` · ${s.name}` : ''}`}</strong>
            <div className="text-xs text-slate-400">{KIND_HINT[s.kind]}</div>
            {s.kind === 'race' && <div className="text-sm">{s.name}</div>}
            {easy && km != null && min != null && (
              <div className="mt-1 rounded-lg bg-navy-900 p-2 text-sm tabular-nums">
                <div>Jarak: <strong className="text-base">{km.toFixed(1)} km</strong> <span className="text-slate-400">(≈{Math.round(min)} menit)</span></div>
                <div>Pace: <strong className="text-base text-emerald-400">{fmtRangeKm(easyPace + delta)}</strong></div>
              </div>
            )}
            {s.kind === 'speed' && min != null && (
              <div className="mt-1 text-sm tabular-nums">Total ≈ <strong>{Math.round(min)} menit</strong> (termasuk pemanasan & pemulihan)</div>
            )}
            {s.adjDurationMin != null && s.durationMin != null && (
              <div className="text-sm tabular-nums text-coral">Durasi disesuaikan: {Math.round(s.durationMin)} → {Math.round(s.adjDurationMin)} menit</div>
            )}
            {s.demoted && <div className="text-xs text-slate-400">Speed diganti Easy Run: tidak ada hari yang tidak bersebelahan dengan Long Run.</div>}
            <div className="mt-1 flex flex-wrap gap-1">
              {(s.adjustments ?? []).map((a) => <span key={a.code} className={badge}>{a.badge}</span>)}
            </div>
            {s.note && <div className="text-xs text-slate-400">{s.note}</div>}
            {s.steps.map((stp, j) => {
              const sec = paceSecPerKm(paceKeyFor(stp), row, delta);
              return <div key={j} className="text-sm">{stp}{sec != null && <em className="text-emerald-400"> → {fmtKm(sec)}</em>}</div>;
            })}
            {gp != null && (s.kind === 'speed' || s.kind === 'race') && (
              <div className="text-sm tabular-nums text-slate-300">
                {s.kind === 'race' ? 'Target pace PB' : `Pace menuju PB ${profile.targetDistance}`}: <span className="font-semibold">{fmtKm(gp)}</span>
              </div>
            )}
            {s.kind !== 'race' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input type="date" value={s.date} max={addDays(raceIso, -1)} aria-label="Ubah tanggal sesi"
                  onChange={(e) => { if (e.target.value) update(setSessionDate(st, s.id, e.target.value)); }} className={`${input} py-1 text-sm`} />
                <select value="" aria-label="Tukar sesi" className={`${input} py-1 text-sm`}
                  onChange={(e) => { const o = swapChoices.find((x) => x.id === e.target.value); if (o) update(swapSessions(st, s, o)); }}>
                  <option value="">Tukar dengan…</option>
                  {swapChoices.map((o) => <option key={o.id} value={o.id}>{formatDayMonth(o.date)} · {KIND_LABEL[o.kind]}</option>)}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
