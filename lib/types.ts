// lib/types.ts
// TypeScript types for Mimic GLP-1 Journal

export interface DailyLog {
  id?: string;
  user_id?: string;
  log_date: string; // YYYY-MM-DD format
  day_number?: number;
  
  // Meals
  meal_bowls: string[]; // Array of 13 elements: 'P', 'V', 'G', 'C', 'R', or ''
  meals_check?: boolean;
  
  // Weight
  weight?: number;
  weight_avg?: number;
  
  // Meal timing
  meal_times: {
    meal1?: string;
    meal2?: string;
    meal3?: string;
    lastMealEnd?: string;
  };
  fasting_window?: string;
  
  // Food log
  food_log: {
    meal1?: string;
    meal2?: string;
    meal3?: string;
  };
  
  // Movement
  movement_items: boolean[]; // [cardio, strength, rest]
  movement_check?: boolean;
  movement_details?: string;
  movement_duration?: number;
  movement_steps?: number;
  
  // Hydration
  hydration_items: boolean[]; // 6 circles
  hydration_check?: boolean;
  
  // Sleep
  sleep_items: boolean[]; // 10 circles
  sleep_check?: boolean;
  
  // Supplements - PHASE 1: ADDED supplements_taken property
  supplements_taken?: string[]; // Array of supplement names taken
  supplements_check?: boolean;
  
  // One-year protocol inputs (see lib/protocol.ts)
  no_sugar?: boolean; // no sugar or jaggery today
  fast_36h?: boolean; // today was the no-meal day of a 36h fast

  // One-year protocol results, computed on save (partner can read only these)
  fasting_minutes?: number | null;
  p_fast16?: boolean;
  p_diet?: boolean;
  p_steps?: boolean;
  p_sleep?: boolean;
  p_strength?: boolean;

  // Notes
  notes?: string;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferences {
  user_id: string;
  start_date: string;
  timezone: string;
  theme: string;
}

export interface BowlType {
  label: string;
  color: string;
}

// Per-user meal limits, stored on user_preferences.meal_limits (jsonb).
// A missing config falls back to DEFAULT_MEAL_LIMITS.
export interface TypeLimit {
  min: number; // minimum bowls of this type (0 = no minimum)
  max: number | null; // maximum bowls of this type (null = no maximum)
}

export interface MealLimits {
  overallMax: number | null; // max total filled bowls (null = no cap)
  types: Record<string, TypeLimit>; // keyed by bowl type code (P, V, G, C, R)
}

// Seeds the historical MGLP-1 rules as closely as per-type min/max allows.
// Note: the old combined "V+G >= 3" rule cannot be expressed per-type, so
// greens carry no minimum here; users set their own in Profile.
export const DEFAULT_MEAL_LIMITS: MealLimits = {
  overallMax: 10,
  types: {
    P: { min: 3, max: null },
    V: { min: 0, max: null },
    G: { min: 0, max: null },
    C: { min: 0, max: 1 },
    R: { min: 0, max: 1 },
  },
};

export const BOWL_TYPES: Record<string, BowlType> = {
  P: { label: 'Protein', color: '#f97316' },
  V: { label: 'Veg', color: '#a3e635' },
  G: { label: 'Green/Raw', color: '#16a34a' },
  C: { label: 'Carbs', color: '#eab308' },
  R: { label: 'Outside', color: '#ef4444' }
};

export const MOVEMENT_TYPES = ['C', 'S', 'R'] as const;

// PHASE 1: SUPPLEMENT TYPES array
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
  'NAC'
];

export const START_DATE = new Date('2026-05-22');