// lib/types.ts

export const START_DATE = new Date('2026-05-22'); // Day 1 = May 22, 2026 (Friday)

export const BOWL_TYPES: Record<string, { color: string; label: string }> = {
  P: { color: '#fb923c', label: 'Protein' },      // Orange
  V: { color: '#86efac', label: 'Vegetables' },   // Light Green
  G: { color: '#16a34a', label: 'Greens' },       // Dark Green (raw veg/fruit)
  C: { color: '#a855f7', label: 'Carbs' },        // Purple
  R: { color: '#ef4444', label: 'Refined' },      // Red
  F: { color: '#06b6d4', label: 'Fruit' },        // Cyan
};

export const MOVEMENT_TYPES = ['C', 'S', 'R'] as const;

export const SUPPLEMENT_TYPES = [
  'Selenium',
  'D3+K2',
  'Omega 3',
  'Vit B12',
  'Magnesium',
  'Milk Thistle',
  'Tart Cherry',
  'Vit C',
  'Zinc',
  'NAC',
] as const;

export interface DailyLog {
  id?: string;
  user_id?: string;
  log_date: string;
  meal_bowls: string[];
  weight?: number;
  weight_avg?: number;
  meal_times: {
    meal1?: string;
    meal2?: string;
    meal3?: string;
    lastMealEnd?: string;
  };
  food_log: {
    meal1?: string;
    meal2?: string;
    meal3?: string;
  };
  supplements_taken: string[]; // Changed from supplements_check
  movement_items: boolean[];
  movement_details?: string;
  movement_duration?: number;
  movement_steps?: number;
  movement_check: boolean;
  hydration_items: boolean[];
  hydration_check: boolean;
  sleep_items: boolean[];
  sleep_check: boolean;
  notes?: string;
  meals_check: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferences {
  id?: string;
  user_id?: string;
  theme?: string;
  notifications?: boolean;
  created_at?: string;
  updated_at?: string;
}