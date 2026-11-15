import { DEFAULT_SCHEDULE_STATE, normalizeScheduleState } from './schedule.ts';
import type { ScheduleState } from './schedule.ts';

export const SCHEDULE_KEY = 'pacelab.schedule';

export function loadScheduleState(): ScheduleState {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return (raw && normalizeScheduleState(JSON.parse(raw))) || { ...DEFAULT_SCHEDULE_STATE, days: [...DEFAULT_SCHEDULE_STATE.days] };
  } catch {
    return { ...DEFAULT_SCHEDULE_STATE, days: [...DEFAULT_SCHEDULE_STATE.days] };
  }
}

export function saveScheduleState(s: ScheduleState): void {
  try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s)); } catch { /* penyimpanan tidak tersedia: abaikan */ }
}
