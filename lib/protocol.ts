// lib/protocol.ts
// One-year protocol (27 Sep 2026 to 26 Sep 2027), tracked as a layer on top of the MGLP-1 program.
// Every protocol rule lives in this file so the daily log, the protocol page and the partner view
// all score a day the same way.

import { DailyLog } from './types';

// ── Program constants ──────────────────────────────────────────────
export const PROTOCOL_START = '2026-09-27'; // Day 1 (a Sunday, so protocol weeks run Sun-Sat)
export const PROTOCOL_DAYS = 365;

export const PROTOCOL_TARGETS = {
  fastMinutes: 16 * 60, // 16h overnight fast
  steps: 8000, // minimum daily steps
  sleepHours: 7, // minimum sleep (sleep circles filled)
  strengthPerWeek: 4, // strength sessions per protocol week
  longFastEveryDays: 14, // one 36h fast per protocol fortnight
};

// Habits scored pass/fail every day. Strength and the 36h fast are scored per week / fortnight.
export type DailyHabit = 'p_fast16' | 'p_diet' | 'p_steps' | 'p_sleep';

export const DAILY_HABITS: { key: DailyHabit; label: string; hint: string }[] = [
  { key: 'p_fast16', label: '16h fast', hint: 'Last meal yesterday to first meal today >= 16h' },
  { key: 'p_diet', label: 'Diet', hint: 'Meals check passed and no sugar/jaggery' },
  { key: 'p_steps', label: '8k steps', hint: 'Steps >= 8,000' },
  { key: 'p_sleep', label: '7h sleep', hint: 'Sleep >= 7 hours' },
];

// What gets stored on daily_logs and is the ONLY thing a partner can read.
export interface ProtocolDay {
  log_date: string;
  p_fast16: boolean;
  p_diet: boolean;
  p_steps: boolean;
  p_sleep: boolean;
  p_strength: boolean;
  fast_36h: boolean;
}

// ── Date helpers (UTC maths on YYYY-MM-DD strings, so timezones can't shift a day) ──
const DAY_MS = 86_400_000;

export function dateToUTC(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function utcToDate(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function addDays(s: string, n: number): string {
  return utcToDate(dateToUTC(s) + n * DAY_MS);
}

// Day 1 = PROTOCOL_START. Returns <= 0 for dates before the protocol.
export function protocolDayNumber(s: string): number {
  return Math.floor((dateToUTC(s) - dateToUTC(PROTOCOL_START)) / DAY_MS) + 1;
}

export function protocolWeek(s: string): number {
  return Math.ceil(protocolDayNumber(s) / 7);
}

export function weekDates(week: number): string[] {
  const first = addDays(PROTOCOL_START, (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function fortnightOf(s: string): { index: number; from: string; to: string } {
  const index = Math.ceil(protocolDayNumber(s) / PROTOCOL_TARGETS.longFastEveryDays);
  const from = addDays(PROTOCOL_START, (index - 1) * PROTOCOL_TARGETS.longFastEveryDays);
  return { index, from, to: addDays(from, PROTOCOL_TARGETS.longFastEveryDays - 1) };
}

// ── Scoring a single day ───────────────────────────────────────────

// Minutes from yesterday's last meal to today's first meal (same wrap-around logic as
// calculateFastingWindow in utils.ts). Null when either time is missing.
export function fastingMinutes(prevLastMealEnd?: string, firstMeal?: string): number | null {
  if (!prevLastMealEnd || !firstMeal) return null;
  const [lh, lm] = prevLastMealEnd.split(':').map(Number);
  const [fh, fm] = firstMeal.split(':').map(Number);
  let mins = fh * 60 + fm - (lh * 60 + lm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

// Scores one day. `log.meals_check` must already reflect the MGLP-1 bowl rules.
// A day ticked as a 36h fast day (no meals) passes the 16h fast and the bowl part of diet,
// and the day after it passes the 16h fast even though yesterday has no last-meal time.
export function evaluateProtocolDay(
  log: DailyLog,
  prevLog?: DailyLog | null
): ProtocolDay & { fasting_minutes: number | null } {
  const fast36 = !!log.fast_36h;
  const prevFast36 = !!prevLog?.fast_36h;
  const mins = fastingMinutes(prevLog?.meal_times?.lastMealEnd, log.meal_times?.meal1);
  const sleepHours = (log.sleep_items || []).filter(Boolean).length;

  return {
    log_date: log.log_date,
    fasting_minutes: mins,
    p_fast16: fast36 || prevFast36 || (mins !== null && mins >= PROTOCOL_TARGETS.fastMinutes),
    p_diet: log.no_sugar === true && (fast36 || !!log.meals_check),
    p_steps: (log.movement_steps ?? 0) >= PROTOCOL_TARGETS.steps,
    p_sleep: sleepHours >= PROTOCOL_TARGETS.sleepHours,
    p_strength: !!log.movement_items?.[1], // index 1 = Strength in MOVEMENT_TYPES
    fast_36h: fast36,
  };
}

// Scores every log in a list, using each log's actual previous-day entry.
export function evaluateAll(logs: DailyLog[]): Map<string, ProtocolDay> {
  const byDate = new Map(logs.map(l => [l.log_date, l]));
  const out = new Map<string, ProtocolDay>();
  for (const log of logs) {
    const prev = byDate.get(addDays(log.log_date, -1)) || null;
    const r = evaluateProtocolDay(log, prev);
    out.set(log.log_date, {
      log_date: r.log_date,
      p_fast16: r.p_fast16,
      p_diet: r.p_diet,
      p_steps: r.p_steps,
      p_sleep: r.p_sleep,
      p_strength: r.p_strength,
      fast_36h: r.fast_36h,
    });
  }
  return out;
}

// ── Aggregates ─────────────────────────────────────────────────────

export interface WeekSummary {
  elapsedDays: number; // days of this week that have happened (a missing log counts as a miss)
  habits: Record<DailyHabit, number>; // days passed per daily habit
  strength: number; // strength sessions this week
  perfectDays: number; // days with all four daily habits passed
}

export function summarizeWeek(days: Map<string, ProtocolDay>, week: number, today: string): WeekSummary {
  const dates = weekDates(week).filter(d => d <= today);
  const habits = { p_fast16: 0, p_diet: 0, p_steps: 0, p_sleep: 0 } as Record<DailyHabit, number>;
  let strength = 0;
  let perfectDays = 0;
  for (const d of dates) {
    const day = days.get(d);
    if (!day) continue;
    let all = true;
    for (const h of DAILY_HABITS) {
      if (day[h.key]) habits[h.key]++;
      else all = false;
    }
    if (day.p_strength) strength++;
    if (all) perfectDays++;
  }
  return { elapsedDays: dates.length, habits, strength, perfectDays };
}

// Consecutive passing days ending today. Today is still in progress (steps and sleep are often
// entered at night), so a missing or failing today never breaks the streak; it only adds if passed.
export function currentStreak(days: Map<string, ProtocolDay>, habit: DailyHabit, today: string): number {
  let d = today;
  if (!days.get(d)?.[habit]) d = addDays(d, -1);
  let n = 0;
  while (d >= PROTOCOL_START && days.get(d)?.[habit]) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// 36h fast status for the fortnight containing `today`, plus the most recent 36h fast.
export function longFastStatus(days: Map<string, ProtocolDay>, today: string) {
  const f = fortnightOf(today);
  let doneThisFortnight = false;
  let last: string | null = null;
  for (const [date, day] of days) {
    if (!day.fast_36h || date > today) continue;
    if (date >= f.from && date <= f.to) doneThisFortnight = true;
    if (!last || date > last) last = date;
  }
  const daysLeft = Math.floor((dateToUTC(f.to) - dateToUTC(today)) / DAY_MS);
  return { ...f, doneThisFortnight, last, daysLeft };
}
