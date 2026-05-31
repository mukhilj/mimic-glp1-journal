'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { DailyLog, BOWL_TYPES, MOVEMENT_TYPES, SUPPLEMENT_TYPES } from '@/lib/types';
import {
  calculateDayNumber,
  formatDate,
  formatDateForDB,
  createEmptyLog,
  calculateFastingWindow,
  checkMealRules,
  checkMovementRules,
  checkHydrationRules,
  checkSleepRules,
  calculate7DayAverage,
} from '@/lib/utils';
import { ChevronLeft, ChevronRight, LogOut, Save, Share2, Printer, Download, Upload, AlertCircle } from 'lucide-react';

// Program start date: June 1, 2026 (Monday) = Day 1
// Total days in 18 months = 548 days (June 1, 2026 - Dec 31, 2027)
const PROGRAM_START_DATE = new Date('2026-06-01');
const TOTAL_PROGRAM_DAYS = 548;

// Override day calculation with new start date
function getDayNumber(date: Date): number {
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  const startOnly = new Date(PROGRAM_START_DATE);
  startOnly.setHours(0, 0, 0, 0);
  
  const diffTime = dateOnly.getTime() - startOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays + 1; // Day 1 starts on June 1, 2026
}

// ============ PHASE 1: NEW VALIDATION FUNCTIONS ============

/**
 * Validate meal bowls based on gender-specific limits and bowl type restrictions
 * Men: <10 bowls max
 * Women: <8 bowls max
 * Carbs (C): <1 (max 0 carbs)
 * Rice (R): <2 (max 1 rice)
 * Returns: { isValid: boolean, warnings: string[] }
 */
function validateMealBowls(
  bowls: string[],
  userGender: 'male' | 'female' = 'male' // Default to male (10 max)
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const filledBowls = bowls.filter(b => b && b !== '');
  
  // Count by type
  const carbCount = filledBowls.filter(b => b === 'C').length;
  const riceCount = filledBowls.filter(b => b === 'R').length;
  const totalCount = filledBowls.length;
  
  // Check gender-specific bowl limits
  const maxBowls = userGender === 'male' ? 10 : 8;
  if (totalCount >= maxBowls) {
    warnings.push(`⚠️ ${userGender === 'male' ? 'Men' : 'Women'}: Max ${maxBowls} bowls (currently: ${totalCount})`);
  }
  
  // Check carb limit (C > 0)
  if (carbCount > 1) {
    warnings.push(`⚠️ Carbs: Max 1 (currently: ${carbCount})`);
  }
  
  // Check rice limit (R > 1)
  if (riceCount > 1) {
    warnings.push(`⚠️ Rice: Max 1 bowl (currently: ${riceCount})`);
  }
  
  // Valid only if NO violations
  const isValid = warnings.length === 0;
  
  return { isValid, warnings };
}

/**
 * Calculate supplement check status
 * Tick if >= 75% of planned supplements are taken
 * Returns: { shouldTick: boolean, percentage: number }
 */
function validateSupplements(
  supplementsTaken: string[], 
  supplementsPlanned?: string[]
): {
  shouldTick: boolean;
  percentage: number;
} {
  const planned = supplementsPlanned || SUPPLEMENT_TYPES;
  
  if (planned.length === 0) {
    return { shouldTick: false, percentage: 0 };
  }
  
  const takenCount = supplementsTaken.length;
  const percentage = Math.round((takenCount / planned.length) * 100);
  const shouldTick = percentage >= 75;
  
  return { shouldTick, percentage };
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentLog, setCurrentLog] = useState<DailyLog>(createEmptyLog(new Date()));
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  
  // PHASE 1: New state for meal validation warnings
  const [mealValidation, setMealValidation] = useState<{ isValid: boolean; warnings: string[] }>({ 
    isValid: true, 
    warnings: [] 
  });
  const [supplementValidation, setSupplementValidation] = useState<{ shouldTick: boolean; percentage: number }>({
    shouldTick: false,
    percentage: 0
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadLog(currentDate);
    }
  }, [currentDate, user]);

  // PHASE 1: Enhanced useEffect - Now includes meal and supplement validation
  useEffect(() => {
    // Get user gender (default to male for 10-bowl limit)
    const userGender = (user?.user_metadata?.gender as 'male' | 'female') || 'male';
    
    // Validate meals
    const mealValidationResult = validateMealBowls(currentLog.meal_bowls, userGender);
    setMealValidation(mealValidationResult);
    
    // Validate supplements
    const supplementValidationResult = validateSupplements(currentLog.supplements_taken || []);
    setSupplementValidation(supplementValidationResult);
    
    // Update checks - only meals_check ticks if meal validation passes AND other rules met
    setCurrentLog(prev => ({
      ...prev,
      meals_check: mealValidationResult.isValid && checkMealRules(prev.meal_bowls),
      supplements_check: supplementValidationResult.shouldTick, // NEW: supplements_check now based on 75% rule
      movement_check: checkMovementRules(prev.movement_items),
      hydration_check: checkHydrationRules(prev.hydration_items),
      sleep_check: checkSleepRules(prev.sleep_items),
    }));
  }, [
    currentLog.meal_bowls,
    currentLog.supplements_taken,
    currentLog.movement_items,
    currentLog.hydration_items,
    currentLog.sleep_items,
    user,
  ]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
    } else {
      setUser(user);
      await loadAllLogs(user.id);
    }
    setLoading(false);
  }

  async function loadAllLogs(userId: string) {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false });

    if (data) setAllLogs(data as DailyLog[]);
  }

  async function loadLog(date: Date) {
    if (!user) return;

    const dateStr = formatDateForDB(date);
    
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', dateStr)
      .single();

    if (data) {
      setCurrentLog(data as DailyLog);
    } else {
      const emptyLog = createEmptyLog(date);
      emptyLog.weight_avg = calculate7DayAverage(allLogs, dateStr);
      setCurrentLog(emptyLog);
    }
  }

  async function saveLog() {
    if (!user) return;
    setSaving(true);

    try {
      const userGender = (user?.user_metadata?.gender as 'male' | 'female') || 'male';
      const mealValidationResult = validateMealBowls(currentLog.meal_bowls, userGender);
      const supplementValidationResult = validateSupplements(currentLog.supplements_taken || []);
      
      const updatedLog = {
        ...currentLog,
        // PHASE 1: Only tick meals_check if validation passes AND other rules met
        meals_check: mealValidationResult.isValid && checkMealRules(currentLog.meal_bowls),
        // PHASE 1: New supplement check based on 75% rule
        supplements_check: supplementValidationResult.shouldTick,
        movement_check: checkMovementRules(currentLog.movement_items),
        hydration_check: checkHydrationRules(currentLog.hydration_items),
        sleep_check: checkSleepRules(currentLog.sleep_items),
        weight_avg: calculate7DayAverage(allLogs, currentLog.log_date),
      };

      await supabase.from('daily_logs').upsert({
        ...updatedLog,
        user_id: user.id,
      });

      showMessage('Saved successfully! ✓', 'success');
      await loadAllLogs(user.id);
    } catch (error: any) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  // Format time from HH:MM to 12-hour format (e.g. "08:30" → "8:30 AM")
  function formatTime(time: string | undefined): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
  }

  // Generate rich text summary for WhatsApp/clipboard
  function generateSummaryText(): string {
    const lines: string[] = [];
    const divider = '─────────────────────';

    // Calculate day number and fasting window
    const dayNum = getDayNumber(currentDate);
    const yesterdayLog = allLogs.find(
      l => l.log_date === formatDateForDB(new Date(currentDate.getTime() - 86400000))
    );
    const fastingWin = calculateFastingWindow(
      yesterdayLog?.meal_times?.lastMealEnd,
      currentLog.meal_times?.meal1
    );

    // ── HEADER ──
    lines.push(`🌿 *MIMIC GLP-1 JOURNAL*`);
    lines.push(`📅 *Day ${dayNum}* — ${new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
    lines.push(divider);

    // ── WEIGHT ──
    if (currentLog.weight) {
      lines.push(`⚖️ *Weight*`);
      lines.push(`   Today: *${currentLog.weight} kg*`);
      if (currentLog.weight_avg) {
        lines.push(`   7-day avg: ${currentLog.weight_avg} kg`);
      }
      lines.push('');
    }

    // ── FASTING ──
    lines.push(`⏱️ *Fasting Period*`);
    if (fastingWin) {
      lines.push(`   Window: *${fastingWin}*`);
    }
    if (yesterdayLog?.meal_times?.lastMealEnd) {
      lines.push(`   Last meal (yesterday): ${formatTime(yesterdayLog.meal_times.lastMealEnd)}`);
    }
    if (currentLog.meal_times?.meal1) {
      lines.push(`   First meal (today): ${formatTime(currentLog.meal_times.meal1)}`);
    }
    if (!fastingWin && !currentLog.meal_times?.meal1) {
      lines.push(`   No fasting data logged`);
    }
    lines.push('');

    // ── MEALS ──
    lines.push(`🍽️ *Meals* ${currentLog.meals_check ? '✅' : '❌'}`);

    // Bowl breakdown
    const filledBowls = currentLog.meal_bowls.filter(Boolean);
    if (filledBowls.length > 0) {
      // Count by type
      const counts: Record<string, number> = {};
      filledBowls.forEach(b => { counts[b] = (counts[b] || 0) + 1; });
      const bowlSummary = Object.entries(counts)
        .map(([id]) => {
          const bowl = BOWL_TYPES[id];
          return bowl ? `${bowl.label}×${counts[id]}` : `${id}×${counts[id]}`;
        })
        .join(' | ');
      lines.push(`   Bowls (${filledBowls.length}): ${bowlSummary}`);

      // Target check
      const p = filledBowls.filter(b => b === 'P').length;
      const v = filledBowls.filter(b => b === 'V').length;
      const g = filledBowls.filter(b => b === 'G').length;
      const r = filledBowls.filter(b => b === 'R').length;
      lines.push(`   P:${p} V:${v} G:${g} R:${r} (Target: P+V+G≥4, R≤2)`);
    } else {
      lines.push(`   No bowls logged`);
    }

    // Meal timing
    const mealTimings: string[] = [];
    if (currentLog.meal_times?.meal1) mealTimings.push(`M1: ${formatTime(currentLog.meal_times.meal1)}`);
    if (currentLog.meal_times?.meal2) mealTimings.push(`M2: ${formatTime(currentLog.meal_times.meal2)}`);
    if (currentLog.meal_times?.meal3) mealTimings.push(`M3: ${formatTime(currentLog.meal_times.meal3)}`);
    if (currentLog.meal_times?.lastMealEnd) mealTimings.push(`End: ${formatTime(currentLog.meal_times.lastMealEnd)}`);
    if (mealTimings.length > 0) {
      lines.push(`   Timing: ${mealTimings.join(' → ')}`);
    }

    // Food log details
    if (currentLog.food_log?.meal1) {
      lines.push(`   🥗 Meal 1: ${currentLog.food_log.meal1}`);
    }
    if (currentLog.food_log?.meal2) {
      lines.push(`   🥗 Meal 2: ${currentLog.food_log.meal2}`);
    }
    if (currentLog.food_log?.meal3) {
      lines.push(`   🥗 Meal 3: ${currentLog.food_log.meal3}`);
    }
    lines.push('');

    // ── MOVEMENT ──
    lines.push(`🏃 *Movement* ${currentLog.movement_check ? '✅' : '❌'}`);
    if (currentLog.movement_items[0] || currentLog.movement_items[1]) {
      const types: string[] = [];
      if (currentLog.movement_items[0]) types.push('Cardio');
      if (currentLog.movement_items[1]) types.push('Strength');
      lines.push(`   Type: ${types.join(' + ')}`);
      if (currentLog.movement_duration) lines.push(`   Duration: ${currentLog.movement_duration} min`);
      if (currentLog.movement_steps) lines.push(`   Steps: ${currentLog.movement_steps.toLocaleString()}`);
      if (currentLog.movement_details) lines.push(`   Details: ${currentLog.movement_details}`);
    } else if (currentLog.movement_items[2]) {
      lines.push(`   Rest day 🛌`);
    } else {
      lines.push(`   Not logged`);
    }
    lines.push('');

    // ── SUPPLEMENTS ──
    const sups = currentLog.supplements_taken || [];
    lines.push(`💊 *Supplements* ${currentLog.supplements_check ? '✅' : '❌'}`);
    if (sups.length > 0) {
      lines.push(`   ${sups.join(' | ')} (${supplementValidation.percentage}%)`);
    } else {
      lines.push(`   None taken`);
    }
    lines.push('');

    // ── HYDRATION ──
    const hydration = currentLog.hydration_items.filter(Boolean).length;
    lines.push(`💧 *Hydration* ${currentLog.hydration_check ? '✅' : '❌'}`);
    lines.push(`   ${hydration}L (Target: 4L+)`);
    lines.push('');

    // ── SLEEP ──
    const sleep = currentLog.sleep_items.filter(Boolean).length;
    lines.push(`😴 *Sleep* ${currentLog.sleep_check ? '✅' : '❌'}`);
    lines.push(`   ${sleep} hours`);
    lines.push('');

    // ── NOTES ──
    if (currentLog.notes) {
      lines.push(`📝 *Notes*`);
      lines.push(`   ${currentLog.notes}`);
      lines.push('');
    }

    // ── FOOTER ──
    lines.push(divider);
    const checks = [
      currentLog.meals_check,
      currentLog.movement_check,
      currentLog.supplements_check,
      currentLog.hydration_check,
      currentLog.sleep_check,
    ].filter(Boolean).length;
    lines.push(`✨ *Daily Score: ${checks}/5 checks completed*`);

    return lines.join('\n');
  }

  // Handle WhatsApp share button - show summary AND copy to clipboard
  async function handleWhatsAppShare() {
    const summaryText = generateSummaryText();
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(summaryText);
      showMessage('Summary copied to clipboard! ✓', 'success');
    } catch (error) {
      // Fallback for older browsers or when clipboard API is not available
      try {
        const textArea = document.createElement('textarea');
        textArea.value = summaryText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('Summary copied to clipboard! ✓', 'success');
      } catch (fallbackError) {
        showMessage('Could not copy to clipboard', 'error');
      }
    }
    
    // Show the modal
    setShowSummary(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function changeDate(days: number) {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  }

  function handlePrintPDF() {
    window.print();
  }

  // Export all data as JSON
  function handleExportData() {
    const exportData = {
      exportDate: new Date().toISOString(),
      logs: allLogs,
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `health-journal-backup-${formatDateForDB(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showMessage('Data exported successfully! ✓', 'success');
  }

  // Import data from JSON
  function handleImportData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.logs || !Array.isArray(importData.logs)) {
          throw new Error('Invalid backup file format');
        }

        // Import logs to database
        for (const log of importData.logs) {
          await supabase.from('daily_logs').upsert({
            ...log,
            user_id: user.id,
          });
        }

        showMessage(`Imported ${importData.logs.length} logs! ✓`, 'success');
        await loadAllLogs(user.id);
      } catch (error: any) {
        showMessage('Error importing: ' + error.message, 'error');
      }
    };
    input.click();
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const dayNumber = getDayNumber(currentDate);
  const progressPercentage = (dayNumber / TOTAL_PROGRAM_DAYS) * 100;
  const fastingWindow = calculateFastingWindow(
    allLogs.find(l => l.log_date === formatDateForDB(new Date(currentDate.getTime() - 86400000)))?.meal_times?.lastMealEnd,
    currentLog.meal_times?.meal1
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      {/* Summary Modal */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-96 overflow-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">📋 Daily Summary</h3>
              <button
                onClick={() => setShowSummary(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 whitespace-pre-wrap font-mono text-sm max-w-2xl overflow-auto max-h-80">
              {generateSummaryText()}
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
              >
                <Share2 size={16} />
                Copy Again
              </button>
              <button
                onClick={() => setShowSummary(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="bg-black/30 text-white">
        <div className="max-w-2xl mx-auto p-4 md:p-6 flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <ChevronLeft size={16} />
              Dashboard
            </button>
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <Printer size={16} />
              PDF
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <Share2 size={16} />
              WhatsApp
            </button>
            <button
              onClick={handleExportData}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <Download size={16} />
              Backup
            </button>
            <button
              onClick={handleImportData}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <Upload size={16} />
              Restore
            </button>
          </div>

          {/* PHASE 1: PROGRESS BAR - Replace day number display */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 inline-block">
            <div className="text-sm opacity-80 mb-2">Program Progress</div>
            {/* Visual Progress Bar */}
            <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-orange-500 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {/* Percentage and Days */}
            <div className="text-lg font-bold">
              {Math.round(progressPercentage)}% — Day {dayNumber}/{TOTAL_PROGRAM_DAYS}
            </div>
            <div className="text-sm opacity-90">{formatDate(currentDate)}</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6">
        {/* Date Navigation */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex items-center gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Prev
          </button>
          <input
            type="date"
            value={formatDateForDB(currentDate)}
            onChange={(e) => setCurrentDate(new Date(e.target.value + 'T12:00:00'))}
            className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-center"
          />
          <button
            onClick={() => changeDate(1)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
          >
            Next
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg font-semibold ${message.includes('Error') ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'}`}>
            {message}
          </div>
        )}

        {/* Weight Tracking */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">⚖️ Weight Tracking</h2>
          <div className="flex gap-3 items-center mb-3">
            <input
              type="number"
              step="0.1"
              value={currentLog.weight || ''}
              onChange={(e) => setCurrentLog({ ...currentLog, weight: parseFloat(e.target.value) || undefined })}
              placeholder="Weight (kg)"
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {currentLog.weight_avg && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">7-Day Moving Average:</span>
                <span className="text-xl font-bold text-indigo-600">{currentLog.weight_avg} kg</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Based on last 7 days of data</p>
            </div>
          )}
        </div>

        {/* MEAL BOWLS - PHASE 1 ENHANCED */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">🍽️ Meal Bowls</h2>
              <p className="text-xs text-gray-500 mt-1">
                Target: Men &lt;10, Women &lt;8 | Carbs &lt;1, Rice &lt;2 | P+V+G ≥4, R≤2
              </p>
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${currentLog.meals_check ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {currentLog.meals_check && <span className="text-white font-bold text-sm">✓</span>}
            </div>
          </div>

          {/* PHASE 1: Display meal validation warnings */}
          {mealValidation.warnings.length > 0 && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-lg p-3 space-y-2">
              {mealValidation.warnings.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {/* Row 1 */}
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <select
                  key={i}
                  value={currentLog.meal_bowls[i] || ''}
                  onChange={(e) => {
                    const bowls = [...currentLog.meal_bowls];
                    bowls[i] = e.target.value;
                    setCurrentLog({ ...currentLog, meal_bowls: bowls });
                  }}
                  className="h-16 rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-center font-bold text-lg"
                  style={{
                    backgroundColor: currentLog.meal_bowls[i] ? BOWL_TYPES[currentLog.meal_bowls[i]]?.color : 'white',
                    color: currentLog.meal_bowls[i] ? 'white' : '#6b7280'
                  }}
                >
                  <option value="">?</option>
                  {Object.entries(BOWL_TYPES).map(([id, bowl]) => (
                    <option key={id} value={id}>{id} - {bowl.label}</option>
                  ))}
                </select>
              ))}
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-5 gap-2">
              {[5, 6, 7, 8, 9].map((i) => (
                <select
                  key={i}
                  value={currentLog.meal_bowls[i] || ''}
                  onChange={(e) => {
                    const bowls = [...currentLog.meal_bowls];
                    bowls[i] = e.target.value;
                    setCurrentLog({ ...currentLog, meal_bowls: bowls });
                  }}
                  className="h-16 rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-center font-bold text-lg"
                  style={{
                    backgroundColor: currentLog.meal_bowls[i] ? BOWL_TYPES[currentLog.meal_bowls[i]]?.color : 'white',
                    color: currentLog.meal_bowls[i] ? 'white' : '#6b7280'
                  }}
                >
                  <option value="">?</option>
                  {Object.entries(BOWL_TYPES).map(([id, bowl]) => (
                    <option key={id} value={id}>{id} - {bowl.label}</option>
                  ))}
                </select>
              ))}
            </div>
            {/* Row 3 - Extra 3 */}
            <div className="grid grid-cols-5 gap-2">
              {[10, 11, 12].map((i) => (
                <select
                  key={i}
                  value={currentLog.meal_bowls[i] || ''}
                  onChange={(e) => {
                    const bowls = [...currentLog.meal_bowls];
                    bowls[i] = e.target.value;
                    setCurrentLog({ ...currentLog, meal_bowls: bowls });
                  }}
                  className="h-16 rounded-lg border-2 border-dashed border-gray-300 focus:border-indigo-500 focus:outline-none text-center font-bold text-lg"
                  style={{
                    backgroundColor: currentLog.meal_bowls[i] ? BOWL_TYPES[currentLog.meal_bowls[i]]?.color : 'white',
                    color: currentLog.meal_bowls[i] ? 'white' : '#6b7280'
                  }}
                >
                  <option value="">?</option>
                  {Object.entries(BOWL_TYPES).map(([id, bowl]) => (
                    <option key={id} value={id}>{id} - {bowl.label}</option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        </div>

        {/* MEAL TIMING */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">⏰ Meal Timing</h2>
          {fastingWindow && (
            <div className="mb-4 bg-green-50 border-2 border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">⏱️ Fasting Window:</span>
                <span className="text-lg font-bold text-green-600">{fastingWindow}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Meal 1</label>
              <input
                type="time"
                value={currentLog.meal_times.meal1 || ''}
                onChange={(e) => setCurrentLog({ ...currentLog, meal_times: { ...currentLog.meal_times, meal1: e.target.value } })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Meal 2</label>
              <input
                type="time"
                value={currentLog.meal_times.meal2 || ''}
                onChange={(e) => setCurrentLog({ ...currentLog, meal_times: { ...currentLog.meal_times, meal2: e.target.value } })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Meal 3</label>
              <input
                type="time"
                value={currentLog.meal_times.meal3 || ''}
                onChange={(e) => setCurrentLog({ ...currentLog, meal_times: { ...currentLog.meal_times, meal3: e.target.value } })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Meal End</label>
              <input
                type="time"
                value={currentLog.meal_times.lastMealEnd || ''}
                onChange={(e) => setCurrentLog({ ...currentLog, meal_times: { ...currentLog.meal_times, lastMealEnd: e.target.value } })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* FOOD LOG */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 Food Log</h2>
          <div className="space-y-3">
            <textarea
              value={currentLog.food_log.meal1 || ''}
              onChange={(e) => setCurrentLog({ ...currentLog, food_log: { ...currentLog.food_log, meal1: e.target.value } })}
              placeholder="Meal 1 details..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none text-sm"
              rows={2}
            />
            <textarea
              value={currentLog.food_log.meal2 || ''}
              onChange={(e) => setCurrentLog({ ...currentLog, food_log: { ...currentLog.food_log, meal2: e.target.value } })}
              placeholder="Meal 2 details..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none text-sm"
              rows={2}
            />
            <textarea
              value={currentLog.food_log.meal3 || ''}
              onChange={(e) => setCurrentLog({ ...currentLog, food_log: { ...currentLog.food_log, meal3: e.target.value } })}
              placeholder="Meal 3 details..."
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none text-sm"
              rows={2}
            />
          </div>
        </div>

        {/* MOVEMENT */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">💪 Movement & Exercise</h2>
              <p className="text-xs text-gray-500 mt-1">C = Cardio, S = Strength, R = Rest</p>
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${currentLog.movement_check ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {currentLog.movement_check && <span className="text-white font-bold text-sm">✓</span>}
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            {MOVEMENT_TYPES.map((type, i) => (
              <button
                key={i}
                onClick={() => {
                  const items = [...currentLog.movement_items];
                  items[i] = !items[i];
                  setCurrentLog({ ...currentLog, movement_items: items });
                }}
                className={`w-10 h-10 rounded-full border-2 font-bold text-sm transition ${
                  currentLog.movement_items[i]
                    ? 'bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-500/50'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <textarea
            value={currentLog.movement_details || ''}
            onChange={(e) => setCurrentLog({ ...currentLog, movement_details: e.target.value })}
            placeholder="Activity details (e.g., 5km run, gym session)"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none text-sm mb-3"
            rows={2}
          />
          <div className="flex gap-3">
            <input
              type="number"
              value={currentLog.movement_duration || ''}
              onChange={(e) => setCurrentLog({ ...currentLog, movement_duration: parseInt(e.target.value) || undefined })}
              placeholder="Duration (minutes)"
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
            />
            <input
              type="number"
              value={currentLog.movement_steps || ''}
              onChange={(e) => setCurrentLog({ ...currentLog, movement_steps: parseInt(e.target.value) || undefined })}
              placeholder="Steps"
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
            />
          </div>
        </div>

        {/* SUPPLEMENTS - PHASE 1 ENHANCED with 75% rule */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">💊 Supplements</h2>
              <p className="text-xs text-gray-500 mt-1">Need ≥75% ({Math.ceil(SUPPLEMENT_TYPES.length * 0.75)}/{SUPPLEMENT_TYPES.length}) to tick</p>
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${currentLog.supplements_check ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {currentLog.supplements_check && <span className="text-white font-bold text-sm">✓</span>}
            </div>
          </div>

          {/* PHASE 1: Show supplement percentage */}
          {(currentLog.supplements_taken || []).length > 0 && (
            <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Completion:</span>
                <span className="text-lg font-bold text-blue-600">{supplementValidation.percentage}% ({(currentLog.supplements_taken || []).length}/{SUPPLEMENT_TYPES.length})</span>
              </div>
              {supplementValidation.shouldTick && (
                <p className="text-xs text-green-600 mt-1">✓ 75% threshold reached!</p>
              )}
              {!supplementValidation.shouldTick && (currentLog.supplements_taken || []).length > 0 && (
                <p className="text-xs text-orange-600 mt-1">Need {Math.ceil(SUPPLEMENT_TYPES.length * 0.75) - (currentLog.supplements_taken || []).length} more to reach 75%</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {SUPPLEMENT_TYPES.map((supplement) => (
              <label key={supplement} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(currentLog.supplements_taken || []).includes(supplement)}
                  onChange={(e) => {
                    const currentTaken = currentLog.supplements_taken || [];
                    const taken = e.target.checked
                      ? [...currentTaken, supplement]
                      : currentTaken.filter(s => s !== supplement);
                    setCurrentLog({ ...currentLog, supplements_taken: taken });
                  }}
                  className="w-5 h-5 rounded border-2 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{supplement}</span>
              </label>
            ))}
          </div>
        </div>

        {/* HYDRATION */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">💧 Hydration</h2>
              <p className="text-xs text-gray-500 mt-1">Target: 4L+ (max 6L)</p>
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${currentLog.hydration_check ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {currentLog.hydration_check && <span className="text-white font-bold text-sm">✓</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentLog.hydration_items.map((filled, i) => (
              <button
                key={i}
                onClick={() => {
                  const items = [...currentLog.hydration_items];
                  items[i] = !items[i];
                  setCurrentLog({ ...currentLog, hydration_items: items });
                }}
                className={`w-10 h-10 rounded-full border-2 font-bold text-sm transition flex items-center justify-center ${
                  filled
                    ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                    : 'border-gray-300 text-gray-400 bg-white'
                }`}
              >
                L
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            {currentLog.hydration_items.filter(Boolean).length}L consumed
          </p>
        </div>

        {/* SLEEP */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">😴 Sleep</h2>
              <p className="text-xs text-gray-500 mt-1">Target: 8 hours</p>
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${currentLog.sleep_check ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {currentLog.sleep_check && <span className="text-white font-bold text-sm">✓</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {currentLog.sleep_items.map((filled, i) => (
              <button
                key={i}
                onClick={() => {
                  const items = [...currentLog.sleep_items];
                  items[i] = !items[i];
                  setCurrentLog({ ...currentLog, sleep_items: items });
                }}
                className={`w-10 h-10 rounded-full border-2 font-bold text-sm transition flex items-center justify-center ${
                  filled
                    ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/50'
                    : 'border-gray-300 text-gray-400 bg-white'
                }`}
              >
                H
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            {currentLog.sleep_items.filter(Boolean).length} hours slept
          </p>
        </div>

        {/* NOTES */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📝 Notes</h2>
          <textarea
            value={currentLog.notes || ''}
            onChange={(e) => setCurrentLog({ ...currentLog, notes: e.target.value })}
            placeholder="Any additional notes for the day..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none text-sm"
            rows={3}
          />
        </div>

        {/* Save Button */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={saveLog}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Log'}
          </button>
        </div>
      </div>
    </div>
  );
}
