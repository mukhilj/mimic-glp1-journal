// lib/utils.ts

import { DailyLog, START_DATE, BOWL_TYPES } from './types';

export function calculateDayNumber(date: Date): number {
  const startTime = new Date(START_DATE).setHours(0, 0, 0, 0);
  const currentTime = new Date(date).setHours(0, 0, 0, 0);
  const diffTime = currentTime - startTime;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateForDB(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEmptyLog(date: Date): DailyLog {
  return {
    log_date: formatDateForDB(date),
    meal_bowls: Array(13).fill(''),
    meal_times: {},
    food_log: {},
    supplements_taken: [], // Changed from supplements_check
    movement_items: Array(3).fill(false),
    movement_check: false,
    hydration_items: Array(6).fill(false),
    hydration_check: false,
    sleep_items: Array(10).fill(false),
    sleep_check: false,
    meals_check: false,
  };
}

export function calculateFastingWindow(lastMealEnd?: string, firstMeal?: string): string | null {
  if (!lastMealEnd || !firstMeal) return null;

  const [lastHour, lastMin] = lastMealEnd.split(':').map(Number);
  const [firstHour, firstMin] = firstMeal.split(':').map(Number);

  let totalMinutes = (firstHour * 60 + firstMin) - (lastHour * 60 + lastMin);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

export function checkMealRules(bowls: string[]): boolean {
  const counts = bowls.reduce((acc, bowl) => {
    if (bowl) acc[bowl] = (acc[bowl] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const P = counts['P'] || 0;
  const V = counts['V'] || 0;
  const G = counts['G'] || 0;
  const R = counts['R'] || 0;

  return P >= 3 && (V + G) >= 3 && R <= 2;
}

export function checkMovementRules(items: boolean[]): boolean {
  // Only count Cardio (index 0) or Strength (index 1), not Rest (index 2)
  return items[0] === true || items[1] === true;
}

export function checkHydrationRules(items: boolean[]): boolean {
  const filled = items.filter(item => item === true).length;
  return filled >= 4;
}

export function checkSleepRules(items: boolean[]): boolean {
  const filled = items.filter(item => item === true).length;
  return filled >= 6;
}

export function calculate7DayAverage(logs: DailyLog[], currentDate: string): number | undefined {
  const endDate = new Date(currentDate);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const relevantLogs = logs.filter(log => {
    const logDate = new Date(log.log_date);
    return logDate >= startDate && logDate <= endDate && log.weight;
  });

  if (relevantLogs.length === 0) return undefined;

  const sum = relevantLogs.reduce((acc, log) => acc + (log.weight || 0), 0);
  return parseFloat((sum / relevantLogs.length).toFixed(1));
}