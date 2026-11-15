// Penjadwalan kalender nyata mundur dari targetRaceDate. Murni (tanpa UI/DOM) agar bisa diuji dengan node:test.
import { NIKE_5K_PLAN } from './nike5k.ts';
import type { Session, SessionKind } from './nike5k.ts';

export type IsoDate = string; // YYYY-MM-DD (kalender, tanpa zona waktu)
export type Phase = 'base' | 'build' | 'taper' | 'race';

const DAY = 86_400_000;
/** Indeks = Date.getUTCDay(): 0 Minggu … 6 Sabtu. */
export const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const WEEKDAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

export const NIKE_WEEKS = NIKE_5K_PLAN.length; // 8
export const BASE_GROWTH = 0.1; // maks +10%/minggu pada fase Base Building
export const TAPER_CUT = 0.35; // pemangkasan volume minggu terakhir (rentang yang diminta: 30–40%)
export const MIN_TRAINING_DAYS = 3;
/** ASUMSI: persentase long run dari volume mingguan pada fase Base. */
const BASE_LONG_SHARE = 0.35;
/** ASUMSI: estimasi durasi sesi speed = jumlah langkah berdurasi, minimal 30 menit (termasuk pemanasan/recovery/pendinginan). */
const SPEED_MIN_MINUTES = 30;

// ───────────────────────── Tanggal (aritmetika nomor hari, aman DST) ─────────────────────────

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIso(s: unknown): s is IsoDate {
  if (typeof s !== 'string') return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export const dayNum = (iso: IsoDate): number => {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Tanggal tidak valid: ${iso}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY;
};
export const fromDayNum = (n: number): IsoDate => new Date(n * DAY).toISOString().slice(0, 10);
export const addDays = (iso: IsoDate, n: number): IsoDate => fromDayNum(dayNum(iso) + n);
export const weekdayOf = (iso: IsoDate): number => new Date(dayNum(iso) * DAY).getUTCDay();

/** Tanggal lomba tersimpan sebagai UTC tengah malam (Date.parse('YYYY-MM-DD') di Profil.tsx). */
export const isoFromRaceTs = (ts: number): IsoDate => new Date(ts).toISOString().slice(0, 10);
/** Tanggal kalender lokal dari timestamp (untuk hari ini dan tanggal sesi lari). */
export function isoFromLocal(ts: number): IsoDate {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Contoh: "Selasa, 17 Nov 2026". */
export function formatDateId(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY_LONG[weekdayOf(iso)]}, ${d} ${MONTH_SHORT[m - 1]} ${y}`;
}
/** Contoh: "17 Nov". */
export function formatDayMonth(iso: IsoDate): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

export interface Remaining { daysRemaining: number; weeksRemaining: number }
/** daysRemaining = ceil((target − hari ini) / 86400000); dihitung pada tanggal kalender sehingga selalu bilangan bulat. */
export function remaining(raceIso: IsoDate, todayIso: IsoDate): Remaining {
  const daysRemaining = dayNum(raceIso) - dayNum(todayIso);
  return { daysRemaining, weeksRemaining: daysRemaining > 0 ? Math.ceil(daysRemaining / 7) : 0 };
}

// ───────────────────────── State jadwal pengguna (localStorage + cadangan JSON) ─────────────────────────

export interface ScheduleState {
  /** Hari latihan rutin (0 = Minggu … 6 = Sabtu). */
  days: number[];
  /** Geser semua sesi (hari); hari lomba tidak ikut bergeser. */
  shift: number;
  /** Tanggal manual per id sesi. */
  overrides: Record<string, IsoDate>;
  /** Centang manual "Selesai". */
  done: Record<string, true>;
}

export const DEFAULT_SCHEDULE_STATE: ScheduleState = { days: [2, 4, 6, 0], shift: 0, overrides: {}, done: {} };
export const SHIFT_LIMIT = 60;

export function normalizeScheduleState(raw: unknown): ScheduleState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r.days)
    ? [...new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [];
  const shift = typeof r.shift === 'number' && Number.isInteger(r.shift) ? Math.max(-SHIFT_LIMIT, Math.min(SHIFT_LIMIT, r.shift)) : 0;
  const overrides: Record<string, IsoDate> = {};
  if (typeof r.overrides === 'object' && r.overrides !== null) {
    for (const [k, v] of Object.entries(r.overrides)) if (isValidIso(v)) overrides[k] = v;
  }
  const done: Record<string, true> = {};
  if (typeof r.done === 'object' && r.done !== null) {
    for (const [k, v] of Object.entries(r.done)) if (v === true) done[k] = true;
  }
  return { days: days.length ? days : [...DEFAULT_SCHEDULE_STATE.days], shift, overrides, done };
}

export function toggleDay(state: ScheduleState, day: number): ScheduleState {
  const has = state.days.includes(day);
  if (has && state.days.length <= MIN_TRAINING_DAYS) return state;
  const days = has ? state.days.filter((d) => d !== day) : [...state.days, day].sort((a, b) => a - b);
  return { ...state, days };
}
export const shiftAll = (state: ScheduleState, delta: number): ScheduleState =>
  ({ ...state, shift: Math.max(-SHIFT_LIMIT, Math.min(SHIFT_LIMIT, state.shift + delta)) });
export const resetSchedule = (state: ScheduleState): ScheduleState => ({ ...state, shift: 0, overrides: {} });
export const setSessionDate = (state: ScheduleState, id: string, iso: IsoDate): ScheduleState =>
  ({ ...state, overrides: { ...state.overrides, [id]: iso } });
export function toggleDone(state: ScheduleState, id: string): ScheduleState {
  const done = { ...state.done };
  if (done[id]) delete done[id];
  else done[id] = true;
  return { ...state, done };
}
/** Tukar tanggal dua sesi (berdasarkan tanggal efektif saat ini). */
export function swapSessions(state: ScheduleState, a: PlanSession, b: PlanSession): ScheduleState {
  return { ...state, overrides: { ...state.overrides, [a.id]: b.date, [b.id]: a.date } };
}

// ───────────────────────── Model rencana ─────────────────────────

export interface Adjustment { code: 'high_load' | 'ef_up' | 'drift' | 'add_volume'; badge: string; reason: string }

export interface PlanSession {
  id: string;
  weekNo: number; // 1..totalWeeks
  phase: Phase;
  kind: SessionKind;
  name: string;
  steps: string[];
  date: IsoDate; // tanggal efektif (setelah geser/ubah manual)
  baseDate: IsoDate; // tanggal hasil penjadwalan otomatis
  distanceKm: number | null;
  durationMin: number | null;
  note?: string;
  demoted?: boolean; // speed → easy karena tidak ada hari yang tidak bersebelahan dengan Long Run
  // Diisi oleh adaptiveEngine
  adjDurationMin?: number;
  paceDeltaSec?: number; // + lebih lambat, − lebih cepat (detik/km)
  convertedFrom?: SessionKind;
  adjustments?: Adjustment[];
}

export interface PlanWeek {
  weekNo: number;
  phase: Phase;
  startIso: IsoDate;
  endIso: IsoDate;
  plannedKm: number | null; // target volume mingguan (hanya fase Base)
  sessions: PlanSession[];
}

export interface Plan {
  weeks: PlanWeek[];
  daysRemaining: number;
  weeksRemaining: number;
  baseWeeks: number;
  totalWeeks: number;
}

export interface PlanOptions {
  raceIso: IsoDate;
  todayIso: IsoDate;
  days: number[];
  raceName: string;
  startWeeklyKm: number;
  maxWeeklyKm: number;
  easyPaceSecPerKm: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function estimateSpeedMinutes(steps: string[]): number {
  let sum = 0;
  for (const s of steps) {
    const m = /^(?:(\d+) x )?(\d+):(\d{2})\b/.exec(s);
    if (m) sum += (m[1] ? Number(m[1]) : 1) * (Number(m[2]) + Number(m[3]) / 60);
  }
  return Math.max(SPEED_MIN_MINUTES, Math.round(sum));
}

/** Durasi/jarak sesi templat Nike. Nama "25:00" = menit; "3.2K / 2 Mile" = km (dikonversi lewat easy pace). */
export function sessionLoad(s: Pick<Session, 'kind' | 'name' | 'steps'>, easyPaceSec: number): { durationMin: number | null; distanceKm: number | null } {
  if (s.kind === 'race') return { durationMin: null, distanceKm: null };
  if (s.kind === 'speed') return { durationMin: estimateSpeedMinutes(s.steps), distanceKm: null };
  const t = /^(\d+):(\d{2})/.exec(s.name);
  if (t) {
    const min = Number(t[1]) + Number(t[2]) / 60;
    return { durationMin: Math.round(min), distanceKm: round1((min * 60) / easyPaceSec) };
  }
  const k = /^(\d+(?:\.\d+)?)K\b/.exec(s.name);
  if (k) {
    const km = Number(k[1]);
    return { durationMin: Math.round((km * easyPaceSec) / 60), distanceKm: km };
  }
  return { durationMin: null, distanceKm: null };
}

const PRIORITY: Record<SessionKind, number> = { race: 4, long: 3, speed: 2, recovery: 1 };

/** Pilih `n` sesi yang dipertahankan: buang prioritas terendah dulu (recovery), yang paling awal lebih dulu. Urutan asli dipertahankan. */
export function pickSessions<T extends { kind: SessionKind }>(list: T[], n: number): number[] {
  const idx = list.map((_, i) => i);
  while (idx.length > Math.max(0, n)) {
    let drop = 0;
    for (let k = 1; k < idx.length; k++) if (PRIORITY[list[idx[k]].kind] < PRIORITY[list[idx[drop]].kind]) drop = k;
    idx.splice(drop, 1);
  }
  return idx;
}

/** Pilih `n` slot dari `slots` (terurut) dengan jarak merata; slot pertama dan terakhir selalu ikut bila n ≥ 2. */
function spreadSlots(slots: IsoDate[], n: number): IsoDate[] {
  if (n >= slots.length) return slots;
  if (n <= 0) return [];
  if (n === 1) return [slots[slots.length - 1]];
  return Array.from({ length: n }, (_, i) => slots[Math.round((i * (slots.length - 1)) / (n - 1))]);
}

const isWeekend = (iso: IsoDate) => { const w = weekdayOf(iso); return w === 0 || w === 6; };
const adjacent = (a: IsoDate | null, b: IsoDate | null) => a != null && b != null && Math.abs(dayNum(a) - dayNum(b)) === 1;

interface Draft { id: string; kind: SessionKind; name: string; steps: string[]; distanceKm: number | null; durationMin: number | null; demoted?: boolean }
interface Ctx { prevLong: IsoDate | null; prevSpeed: IsoDate | null }

/**
 * Tempatkan sesi pada slot hari. Aturan: Long Run di akhir pekan pilihan (Sab/Min) bila ada;
 * Speed tidak bersebelahan dengan Long Run (minggu ini maupun sebelumnya) dan sebisa mungkin tidak bersebelahan satu sama lain.
 * Speed yang tidak bisa ditempatkan tanpa melanggar aturan diturunkan menjadi Easy Run.
 */
export function assignWeek(drafts: Draft[], slotsAll: IsoDate[], ctx: Ctx): Array<{ draft: Draft; date: IsoDate }> {
  const slots = spreadSlots(slotsAll, drafts.length);
  const free = [...slots];
  const out: Array<{ draft: Draft; date: IsoDate }> = [];
  const take = (d: IsoDate) => free.splice(free.indexOf(d), 1);

  let longDate: IsoDate | null = null;
  const longDraft = drafts.find((d) => d.kind === 'long');
  if (longDraft && free.length) {
    const ok = free.filter((d) => !adjacent(d, ctx.prevSpeed));
    const pool = ok.length ? ok : free;
    const weekend = pool.filter(isWeekend);
    longDate = (weekend.length ? weekend : pool)[(weekend.length ? weekend : pool).length - 1];
    take(longDate);
    out.push({ draft: longDraft, date: longDate });
  }

  const speedDates: IsoDate[] = [];
  const placed = new Map<Draft, IsoDate>();
  for (const d of drafts.filter((x) => x.kind === 'speed')) {
    const hardOk = free.filter((s) => !adjacent(s, longDate) && !adjacent(s, ctx.prevLong));
    const soft = hardOk.filter((s) => !speedDates.some((p) => adjacent(s, p)));
    const pick = (soft.length ? soft : hardOk)[0];
    if (pick) {
      take(pick);
      speedDates.push(pick);
      placed.set(d, pick);
    }
  }
  for (const d of drafts) {
    if (d.kind === 'speed') {
      const dt = placed.get(d);
      if (dt) out.push({ draft: d, date: dt });
      else if (free.length) {
        const dt2 = free.shift() as IsoDate;
        out.push({ draft: { ...d, kind: 'recovery', name: 'Easy Run (pengganti Speed)', steps: [], durationMin: Math.min(d.durationMin ?? 35, 35), demoted: true }, date: dt2 });
      }
    } else if (d.kind === 'recovery') {
      if (free.length) out.push({ draft: d, date: free.shift() as IsoDate });
    }
  }
  return out.sort((a, b) => dayNum(a.date) - dayNum(b.date));
}

/** Volume mingguan Base: +10%/minggu dari volume awal, berhenti naik di batas `maxKm`. */
export function baseVolumes(count: number, startKm: number, maxKm: number): number[] {
  const start = Math.max(1, startKm);
  const cap = Math.max(maxKm, start);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(round1(Math.min(cap, i === 0 ? start : out[i - 1] * (1 + BASE_GROWTH))));
  return out;
}

export function buildPlan(o: PlanOptions): Plan {
  const { daysRemaining, weeksRemaining } = remaining(o.raceIso, o.todayIso);
  if (daysRemaining < 0) return { weeks: [], daysRemaining, weeksRemaining: 0, baseWeeks: 0, totalWeeks: 0 };

  const total = Math.max(1, weeksRemaining);
  const nikeCount = Math.min(NIKE_WEEKS, total);
  const baseCount = total - nikeCount;
  const volumes = baseVolumes(baseCount, o.startWeeklyKm, o.maxWeeklyKm);
  const nominal = Math.max(1, o.days.length);
  const raceDay = o.raceIso;
  const weeks: PlanWeek[] = [];
  let ctx: Ctx = { prevLong: null, prevSpeed: null };

  for (let i = 0; i < total; i++) {
    const end = addDays(raceDay, -7 * (total - 1 - i));
    const start = addDays(end, -6);
    const isLast = i === total - 1;
    const isBase = i < baseCount;
    const nikeIdx = NIKE_WEEKS - nikeCount + (i - baseCount);

    let slots: IsoDate[] = [];
    for (let d = Math.max(dayNum(start), dayNum(o.todayIso)); d <= dayNum(end); d++) {
      const iso = fromDayNum(d);
      if (o.days.includes(weekdayOf(iso)) && !(isLast && iso === raceDay)) slots.push(iso);
    }
    // Minggu lomba: sisakan hari sebelum lomba untuk istirahat bila masih ada ≥ 2 slot lain.
    if (isLast && slots.length > 2 && slots[slots.length - 1] === addDays(raceDay, -1)) slots = slots.slice(0, -1);

    let drafts: Draft[];
    const plannedKm = isBase ? volumes[i] : null;
    if (isBase) {
      const longKm = nominal === 1 ? volumes[i] : round1(volumes[i] * BASE_LONG_SHARE);
      const easyKm = nominal > 1 ? round1((volumes[i] - longKm) / (nominal - 1)) : 0;
      const bj = baseCount - i; // b1 = minggu Base tepat sebelum blok puncak (id stabil seiring waktu)
      const mk = (kind: SessionKind, km: number, k: number): Draft => ({
        id: `b${bj}-${k}`, kind, name: kind === 'long' ? 'Long Run' : 'Easy Run', steps: [],
        distanceKm: km, durationMin: Math.round((km * o.easyPaceSecPerKm) / 60),
      });
      drafts = [...Array.from({ length: nominal - 1 }, (_, k) => mk('recovery', easyKm, k)), mk('long', longKm, nominal - 1)];
      if (nominal === 1) drafts = [mk('long', longKm, 0)];
    } else {
      drafts = [];
      NIKE_5K_PLAN[nikeIdx].sessions.forEach((s, k) => {
        if (s.kind === 'race') return;
        drafts.push({ id: `n${nikeIdx}-${k}`, kind: s.kind, name: s.name, steps: s.steps, ...sessionLoad(s, o.easyPaceSecPerKm) });
      });
    }

    const keep = pickSessions(drafts, slots.length).map((k) => drafts[k]);
    const placed = assignWeek(keep, slots, ctx);
    const phase: Phase = isBase ? 'base' : isLast ? 'taper' : 'build';

    const sessions: PlanSession[] = placed.map(({ draft, date }) => {
      let { durationMin, distanceKm, name } = draft;
      let note: string | undefined;
      if (phase === 'taper') {
        const f = 1 - TAPER_CUT;
        if (durationMin != null) durationMin = Math.round(durationMin * f);
        if (distanceKm != null) distanceKm = round1(distanceKm * f);
        if (draft.kind === 'speed') note = `Taper: kurangi volume ±${Math.round(TAPER_CUT * 100)}% (lebih sedikit pengulangan), pertahankan pace.`;
        else if (durationMin != null) { name = `${durationMin} menit (taper −${Math.round(TAPER_CUT * 100)}%)`; }
      }
      return {
        id: draft.id, weekNo: i + 1, phase, kind: draft.kind, name, steps: draft.steps,
        date, baseDate: date, distanceKm, durationMin, note, demoted: draft.demoted,
      };
    });

    if (isLast) {
      sessions.push({
        id: 'race', weekNo: i + 1, phase: 'race', kind: 'race', name: o.raceName, steps: [],
        date: raceDay, baseDate: raceDay, distanceKm: null, durationMin: null,
      });
    }

    const longS = [...sessions].reverse().find((s) => s.kind === 'long');
    const speedS = [...sessions].reverse().find((s) => s.kind === 'speed');
    ctx = { prevLong: longS?.date ?? ctx.prevLong, prevSpeed: speedS?.date ?? null };
    weeks.push({ weekNo: i + 1, phase, startIso: start, endIso: end, plannedKm, sessions });
  }
  return { weeks, daysRemaining, weeksRemaining, baseWeeks: baseCount, totalWeeks: total };
}

/** Terapkan geser global & tanggal manual. Hari lomba tetap; sesi lain tidak boleh jatuh pada/setelah hari lomba. */
export function applyScheduleState(plan: Plan, state: ScheduleState, raceIso: IsoDate): Plan {
  const lastAllowed = addDays(raceIso, -1);
  const weeks = plan.weeks.map((w) => ({
    ...w,
    sessions: w.sessions.map((s) => {
      if (s.kind === 'race') return s;
      let date = state.overrides[s.id] ?? addDays(s.baseDate, state.shift);
      if (dayNum(date) > dayNum(lastAllowed)) date = lastAllowed;
      return { ...s, date };
    }),
  }));
  return { ...plan, weeks };
}

export const flattenPlan = (plan: Plan): PlanSession[] =>
  plan.weeks.flatMap((w) => w.sessions).sort((a, b) => dayNum(a.date) - dayNum(b.date) || a.weekNo - b.weekNo);

/** Selesai bila dicentang manual, atau (tanggal ≤ hari ini) ada catatan latihan pada tanggal itu. */
export function completedIds(sessions: PlanSession[], workoutDays: ReadonlySet<IsoDate>, state: ScheduleState, todayIso: IsoDate): Set<string> {
  const out = new Set<string>();
  for (const s of sessions) {
    if (state.done[s.id] || (dayNum(s.date) <= dayNum(todayIso) && workoutDays.has(s.date))) out.add(s.id);
  }
  return out;
}
export const autoCompleted = (s: PlanSession, workoutDays: ReadonlySet<IsoDate>, todayIso: IsoDate): boolean =>
  dayNum(s.date) <= dayNum(todayIso) && workoutDays.has(s.date);
