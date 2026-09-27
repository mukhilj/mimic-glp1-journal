// scripts/meal-rules.test.ts
// Checks validateMeals in lib/utils.ts. Run: npx tsx scripts/meal-rules.test.ts
import { validateMeals } from '../lib/utils';
import { DEFAULT_MEAL_LIMITS, MealLimits } from '../lib/types';

const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const bowls = (s: string) => s.split(''); // e.g. 'PPPVGC'

// Default limits: overallMax 10, P>=3, C<=1, R<=1
ok(validateMeals(bowls('PPPVG'), DEFAULT_MEAL_LIMITS).isValid, 'default: 3P + greens passes');
ok(!validateMeals(bowls('PPVG'), DEFAULT_MEAL_LIMITS).isValid, 'default: only 2P fails (P min 3)');
ok(!validateMeals(bowls('PPPCC'), DEFAULT_MEAL_LIMITS).isValid, 'default: 2 carbs fails (C max 1)');
ok(validateMeals(bowls('PPPC'), DEFAULT_MEAL_LIMITS).isValid, 'default: 1 carb passes');
ok(!validateMeals(bowls('PPPRR'), DEFAULT_MEAL_LIMITS).isValid, 'default: 2 outside fails (R max 1)');
ok(validateMeals(bowls('PPPPPPPPPP'), DEFAULT_MEAL_LIMITS).isValid, 'default: exactly 10 bowls passes (max inclusive)');
ok(!validateMeals(bowls('PPPPPPPPPPP'), DEFAULT_MEAL_LIMITS).isValid, 'default: 11 bowls fails overall cap');

// Empty / absent config uses defaults
ok(!validateMeals(bowls('PPVG')).isValid, 'no config arg -> uses default (2P fails)');

// Blanks in the array are ignored
ok(validateMeals(['P','','P','','P','V'], DEFAULT_MEAL_LIMITS).isValid, 'blank slots ignored');

// null max = no ceiling; min 0 = no floor
const permissive: MealLimits = { overallMax: null, types: { P: { min: 0, max: null }, V: { min: 0, max: null }, G: { min: 0, max: null }, C: { min: 0, max: null }, R: { min: 0, max: null } } };
ok(validateMeals(bowls('CCCCCCCCCCCC'), permissive).isValid, 'permissive config: anything passes');

// Custom per-user config is honoured
const custom: MealLimits = { overallMax: 6, types: { P: { min: 2, max: 4 }, V: { min: 1, max: null }, G: { min: 0, max: null }, C: { min: 0, max: 0 }, R: { min: 0, max: 0 } } };
ok(validateMeals(bowls('PPV'), custom).isValid, 'custom: 2P + 1V passes');
ok(!validateMeals(bowls('PPPPPV'), custom).isValid, 'custom: 5P fails P max 4');
ok(!validateMeals(bowls('PP'), custom).isValid, 'custom: missing V min 1 fails');
ok(!validateMeals(bowls('PPVC'), custom).isValid, 'custom: any carb fails C max 0');
