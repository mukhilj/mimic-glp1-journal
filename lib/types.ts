// lib/types.ts
// TypeScript types for Mimic GLP-1 Journal

export interface DailyLog {
  id?: string;
  user_id?: string;
  log_date: string; // YYYY-MM-DD format
  day_number: number;
  
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