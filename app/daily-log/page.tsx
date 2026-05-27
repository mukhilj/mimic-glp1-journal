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
import { ChevronLeft, ChevronRight, LogOut, Save, Share2, Printer, Download, Upload } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentLog, setCurrentLog] = useState<DailyLog>(createEmptyLog(new Date()));
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSummary, setShowSummary] = useState(false);

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

  useEffect(() => {
    setCurrentLog(prev => ({
      ...prev,
      meals_check: checkMealRules(prev.meal_bowls),
      movement_check: checkMovementRules(prev.movement_items),
      hydration_check: checkHydrationRules(prev.hydration_items),
      sleep_check: checkSleepRules(prev.sleep_items),
    }));
  }, [
    currentLog.meal_bowls,
    currentLog.movement_items,
    currentLog.hydration_items,
    currentLog.sleep_items,
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
      const updatedLog = {
        ...currentLog,
        meals_check: checkMealRules(currentLog.meal_bowls),
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
    const dayNum = calculateDayNumber(currentDate);
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
    lines.push(`💊 *Supplements* ${sups.length > 0 ? '✅' : '❌'}`);
    if (sups.length > 0) {
      lines.push(`   ${sups.join(' | ')}`);
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
      sups.length > 0,
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

        await loadAllLogs(user.id);
        showMessage('Data imported successfully! ✓', 'success');
      } catch (error: any) {
        showMessage('Import failed: ' + error.message, 'error');
      }
    };
    input.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  const dayNumber = calculateDayNumber(currentDate);
  const yesterdayLog = allLogs.find(l => l.log_date === formatDateForDB(new Date(currentDate.getTime() - 86400000)));
  const fastingWindow = calculateFastingWindow(yesterdayLog?.meal_times.lastMealEnd, currentLog.meal_times.meal1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg">
        <div className="max-w-2xl mx-auto p-6 md:p-8">
          {/* Top Row: Title and Sign Out */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xs font-semibold tracking-widest uppercase opacity-80 mb-1">
                MY HEALTH COMPANION
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">
                Mimic GLP-1 Journal
              </h1>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap gap-2 mb-6">
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

          {/* Day Info */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 inline-block">
            <div className="text-sm opacity-80 mb-1">
              {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
            </div>
            <div className="text-4xl md:text-5xl font-bold mb-1">Day {dayNumber}</div>
            <div className="text-lg opacity-90">{formatDate(currentDate)}</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6">
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

        {/* MEAL BOWLS with DROPDOWNS */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">🍽️ Meal Bowls</h2>
              <p className="text-xs text-gray-500 mt-1">Target: 6 bowls (P+V+G ≥4, R≤2)</p>
            </div>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${currentLog.meals_check ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {currentLog.meals_check && <span className="text-white font-bold text-sm">✓</span>}
            </div>
          </div>
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

        {/* SUPPLEMENTS - 10 CHECKBOXES */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">💊 Supplements</h2>
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
                  const newValue = !items[i];
                  for (let j = 0; j <= i; j++) {
                    items[j] = newValue;
                  }
                  if (!newValue) {
                    for (let j = i + 1; j < items.length; j++) {
                      items[j] = false;
                    }
                  }
                  setCurrentLog({ ...currentLog, hydration_items: items });
                }}
                className={`w-9 h-9 rounded-full border-2 font-bold text-xs transition ${
                  i >= 4 ? 'border-dashed' : ''
                } ${
                  filled
                    ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                    : 'border-gray-300 text-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* SLEEP */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">😴 Sleep</h2>
              <p className="text-xs text-gray-500 mt-1">Target: 6h+ (goal: 8h+, max 10h)</p>
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
                  const newValue = !items[i];
                  for (let j = 0; j <= i; j++) {
                    items[j] = newValue;
                  }
                  if (!newValue) {
                    for (let j = i + 1; j < items.length; j++) {
                      items[j] = false;
                    }
                  }
                  setCurrentLog({ ...currentLog, sleep_items: items });
                }}
                className={`w-9 h-9 rounded-full border-2 font-bold text-xs transition ${
                  i >= 8 ? 'border-dashed' : ''
                } ${
                  filled
                    ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/50'
                    : 'border-gray-300 text-gray-400'
                }`}
              />
            ))}
          </div>
        </div>

        {/* NOTES */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📌 Notes</h2>
          <textarea
            value={currentLog.notes || ''}
            onChange={(e) => setCurrentLog({ ...currentLog, notes: e.target.value })}
            placeholder="Add your notes here..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none text-sm"
            rows={4}
          />
        </div>

        {/* SAVE BUTTON */}
        <button
          onClick={saveLog}
          disabled={saving}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Entry'}
        </button>
      </div>

      {/* MESSAGE TOAST */}
      {message && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl font-semibold ${
          message.includes('Error') ? 'bg-red-500' : 'bg-green-500'
        } text-white z-50`}>
          {message}
        </div>
      )}

      {/* WHATSAPP SUMMARY MODAL */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="text-center mb-4 pb-4 border-b border-gray-100">
              <div className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-1">Mimic GLP-1 Journal</div>
              <h1 className="text-3xl font-bold text-indigo-600">Day {dayNumber}</h1>
              <p className="text-gray-600 text-sm mt-1">{formatDate(currentDate)}</p>
              <p className="text-xs text-gray-400">{new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long' })}</p>
              {/* Daily Score */}
              <div className="mt-3 flex justify-center gap-2">
                {[
                  { check: currentLog.meals_check, label: '🍽️' },
                  { check: currentLog.movement_check, label: '🏃' },
                  { check: (currentLog.supplements_taken || []).length > 0, label: '💊' },
                  { check: currentLog.hydration_check, label: '💧' },
                  { check: currentLog.sleep_check, label: '😴' },
                ].map((item, i) => (
                  <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${item.check ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {item.label}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {[currentLog.meals_check, currentLog.movement_check, (currentLog.supplements_taken||[]).length > 0, currentLog.hydration_check, currentLog.sleep_check].filter(Boolean).length}/5 completed
              </p>
            </div>

            <div className="space-y-4">
              {/* Weight */}
              {currentLog.weight && (
                <div className="bg-indigo-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">⚖️ Weight</span>
                    <span className="text-xl font-bold text-indigo-600">{currentLog.weight} kg</span>
                  </div>
                  {currentLog.weight_avg && (
                    <p className="text-xs text-gray-500 mt-1 text-right">7-day avg: {currentLog.weight_avg} kg</p>
                  )}
                </div>
              )}

              {/* Fasting */}
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-700">⏱️ Fasting Period</span>
                  {fastingWindow && <span className="text-lg font-bold text-green-600">{fastingWindow}</span>}
                </div>
                <div className="flex gap-4 text-xs text-gray-600 flex-wrap">
                  {yesterdayLog?.meal_times?.lastMealEnd && (
                    <span>Last meal (yesterday): <strong>{
                      (() => {
                        const [h, m] = yesterdayLog.meal_times.lastMealEnd.split(':').map(Number);
                        const p = h >= 12 ? 'PM' : 'AM';
                        return `${h%12||12}:${m.toString().padStart(2,'0')} ${p}`;
                      })()
                    }</strong></span>
                  )}
                  {currentLog.meal_times?.meal1 && (
                    <span>First meal (today): <strong>{
                      (() => {
                        const [h, m] = currentLog.meal_times.meal1.split(':').map(Number);
                        const p = h >= 12 ? 'PM' : 'AM';
                        return `${h%12||12}:${m.toString().padStart(2,'0')} ${p}`;
                      })()
                    }</strong></span>
                  )}
                  {!fastingWindow && !currentLog.meal_times?.meal1 && (
                    <span className="text-gray-400">No data logged</span>
                  )}
                </div>
              </div>

              {/* Meals */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-gray-700">🍽️ Meals</span>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center ${currentLog.meals_check ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {currentLog.meals_check && <span className="text-white text-xs">✓</span>}
                  </span>
                </div>

                {/* Bowl breakdown */}
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {Object.entries(BOWL_TYPES).map(([id, bowl]) => {
                    const count = currentLog.meal_bowls.filter((b) => b === id).length;
                    if (count === 0) return null;
                    return (
                      <div key={id} className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: bowl.color }}>
                        {bowl.label} ×{count}
                      </div>
                    );
                  })}
                  {currentLog.meal_bowls.filter(Boolean).length === 0 && (
                    <span className="text-gray-400 text-xs">No bowls logged</span>
                  )}
                </div>

                {/* Meal timing row */}
                {(currentLog.meal_times?.meal1 || currentLog.meal_times?.meal2 || currentLog.meal_times?.meal3) && (
                  <div className="flex gap-2 flex-wrap text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                    {currentLog.meal_times?.meal1 && (
                      <span className="bg-white px-2 py-1 rounded-lg border border-gray-200">
                        M1: {(() => { const [h,m] = currentLog.meal_times.meal1.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; })()}
                      </span>
                    )}
                    {currentLog.meal_times?.meal2 && (
                      <span className="bg-white px-2 py-1 rounded-lg border border-gray-200">
                        M2: {(() => { const [h,m] = currentLog.meal_times.meal2.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; })()}
                      </span>
                    )}
                    {currentLog.meal_times?.meal3 && (
                      <span className="bg-white px-2 py-1 rounded-lg border border-gray-200">
                        M3: {(() => { const [h,m] = currentLog.meal_times.meal3.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; })()}
                      </span>
                    )}
                    {currentLog.meal_times?.lastMealEnd && (
                      <span className="bg-white px-2 py-1 rounded-lg border border-gray-200">
                        End: {(() => { const [h,m] = currentLog.meal_times.lastMealEnd.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; })()}
                      </span>
                    )}
                  </div>
                )}

                {/* Food log details */}
                {(currentLog.food_log?.meal1 || currentLog.food_log?.meal2 || currentLog.food_log?.meal3) && (
                  <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
                    {currentLog.food_log?.meal1 && (
                      <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">M1:</span> {currentLog.food_log.meal1}</p>
                    )}
                    {currentLog.food_log?.meal2 && (
                      <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">M2:</span> {currentLog.food_log.meal2}</p>
                    )}
                    {currentLog.food_log?.meal3 && (
                      <p className="text-xs text-gray-600"><span className="font-semibold text-gray-700">M3:</span> {currentLog.food_log.meal3}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Movement */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-700">🏃 Movement</span>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center ${currentLog.movement_check ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {currentLog.movement_check && <span className="text-white text-xs">✓</span>}
                  </span>
                </div>
                {(currentLog.movement_items[0] || currentLog.movement_items[1]) ? (
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-semibold text-gray-700">
                      {[currentLog.movement_items[0] && 'Cardio', currentLog.movement_items[1] && 'Strength'].filter(Boolean).join(' + ')}
                    </p>
                    {currentLog.movement_duration && <p>{currentLog.movement_duration} minutes</p>}
                    {currentLog.movement_steps && <p>{currentLog.movement_steps.toLocaleString()} steps</p>}
                    {currentLog.movement_details && <p className="text-xs text-gray-500">{currentLog.movement_details}</p>}
                  </div>
                ) : currentLog.movement_items[2] ? (
                  <p className="text-sm text-gray-500">Rest day 🛌</p>
                ) : (
                  <p className="text-sm text-gray-400">Not logged</p>
                )}
              </div>

              {/* Supplements */}
              {(currentLog.supplements_taken || []).length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="font-bold text-gray-700">💊 Supplements</span>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {(currentLog.supplements_taken || []).map(sup => (
                      <span key={sup} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-medium">{sup}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hydration + Sleep */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-700 text-sm">💧 Hydration</span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center ${currentLog.hydration_check ? 'bg-green-500' : 'bg-gray-300'}`}>
                      {currentLog.hydration_check && <span className="text-white text-xs">✓</span>}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-cyan-600">{currentLog.hydration_items.filter(Boolean).length}L</p>
                  <p className="text-xs text-gray-400">Target: 4L+</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-700 text-sm">😴 Sleep</span>
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center ${currentLog.sleep_check ? 'bg-green-500' : 'bg-gray-300'}`}>
                      {currentLog.sleep_check && <span className="text-white text-xs">✓</span>}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-purple-600">{currentLog.sleep_items.filter(Boolean).length}h</p>
                </div>
              </div>

              {/* Notes */}
              {currentLog.notes && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <span className="font-bold text-gray-700">📝 Notes</span>
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{currentLog.notes}</p>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition text-sm"
              >
                📋 Copy Again
              </button>
              <button
                onClick={() => setShowSummary(false)}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
