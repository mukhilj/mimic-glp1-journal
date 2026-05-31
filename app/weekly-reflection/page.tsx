'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { DailyLog } from '@/lib/types';
import { formatDateForDB, formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Save, Share2, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const PROGRAM_START_DATE = new Date('2026-06-01');
const TOTAL_PROGRAM_DAYS = 548;

// Calculate which week we're in (Monday-based)
function getWeekNumber(date: Date): number {
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  const startOnly = new Date(PROGRAM_START_DATE);
  startOnly.setHours(0, 0, 0, 0);
  
  // Get the Monday of the week containing the date
  const day = dateOnly.getDay();
  const diff = dateOnly.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(dateOnly.setDate(diff));
  
  // Calculate weeks since program start
  const diffTime = monday.getTime() - startOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diffDays / 7) + 1;
  
  return weekNum;
}

// Get week date range (Monday to Sunday)
function getWeekDateRange(weekNumber: number): { start: Date; end: Date } {
  const startDate = new Date(PROGRAM_START_DATE);
  startDate.setHours(0, 0, 0, 0);
  
  // Add days to get to the start of the target week
  const daysToAdd = (weekNumber - 1) * 7;
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() + daysToAdd);
  
  // End is 6 days later (Sunday of same week)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  return { start: weekStart, end: weekEnd };
}

// Format week range like "Week 1 (Jun 1-7)"
function formatWeekRange(weekNumber: number): string {
  const { start, end } = getWeekDateRange(weekNumber);
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week ${weekNumber} (${startStr}-${endStr})`;
}

// PHASE 2: Calculate sector-wise metrics
interface SectorMetrics {
  name: string;
  daysReached: number;
  totalDays: number;
  percentage: number;
}

function calculateSectorMetrics(
  dailyLogs: DailyLog[],
  weekNumber: number
): SectorMetrics[] {
  const { start, end } = getWeekDateRange(weekNumber);
  
  // Get all logs for this week
  const weekLogs = dailyLogs.filter(log => {
    const logDate = new Date(log.log_date);
    return logDate >= start && logDate <= end;
  });
  
  // Count days each sector was met
  const meals = weekLogs.filter(l => l.meals_check).length;
  const supplements = weekLogs.filter(l => l.supplements_check).length;
  const hydration = weekLogs.filter(l => l.hydration_check).length;
  const movement = weekLogs.filter(l => l.movement_check).length;
  const sleep = weekLogs.filter(l => l.sleep_check).length;
  
  const totalDays = Math.min(7, weekLogs.length); // Max 7 days in a week
  
  return [
    { name: 'Meals', daysReached: meals, totalDays, percentage: totalDays > 0 ? (meals / totalDays) * 100 : 0 },
    { name: 'Supplements', daysReached: supplements, totalDays, percentage: totalDays > 0 ? (supplements / totalDays) * 100 : 0 },
    { name: 'Hydration', daysReached: hydration, totalDays, percentage: totalDays > 0 ? (hydration / totalDays) * 100 : 0 },
    { name: 'Movement', daysReached: movement, totalDays, percentage: totalDays > 0 ? (movement / totalDays) * 100 : 0 },
    { name: 'Sleep', daysReached: sleep, totalDays, percentage: totalDays > 0 ? (sleep / totalDays) * 100 : 0 },
  ];
}

// PHASE 2: Calculate win rate (days with 4/5 habits)
function calculateWinRate(dailyLogs: DailyLog[], weekNumber: number): { winDays: number; totalDays: number; percentage: number } {
  const { start, end } = getWeekDateRange(weekNumber);
  
  const weekLogs = dailyLogs.filter(log => {
    const logDate = new Date(log.log_date);
    return logDate >= start && logDate <= end;
  });
  
  const winDays = weekLogs.filter(log => {
    const checks = [log.meals_check, log.supplements_check, log.hydration_check, log.movement_check, log.sleep_check].filter(Boolean).length;
    return checks >= 4; // Win if 4+ out of 5 habits
  }).length;
  
  const totalDays = Math.min(7, weekLogs.length);
  const percentage = totalDays > 0 ? (winDays / totalDays) * 100 : 0;
  
  return { winDays, totalDays, percentage };
}

// PHASE 2: Compare current week vs previous week
function compareWeeks(
  currentMetrics: SectorMetrics[],
  previousMetrics: SectorMetrics[]
): { sector: string; current: number; previous: number; change: number; trend: 'up' | 'down' | 'equal' }[] {
  return currentMetrics.map((curr, idx) => {
    const prev = previousMetrics[idx] || { daysReached: 0 };
    const change = curr.daysReached - prev.daysReached;
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'equal';
    
    return {
      sector: curr.name,
      current: curr.daysReached,
      previous: prev.daysReached,
      change,
      trend,
    };
  });
}

// PHASE 2: Calculate average vs all previous weeks
function calculateAverageMetrics(dailyLogs: DailyLog[], currentWeekNumber: number): SectorMetrics[] {
  if (currentWeekNumber <= 1) {
    return [
      { name: 'Meals', daysReached: 0, totalDays: 7, percentage: 0 },
      { name: 'Supplements', daysReached: 0, totalDays: 7, percentage: 0 },
      { name: 'Hydration', daysReached: 0, totalDays: 7, percentage: 0 },
      { name: 'Movement', daysReached: 0, totalDays: 7, percentage: 0 },
      { name: 'Sleep', daysReached: 0, totalDays: 7, percentage: 0 },
    ];
  }
  
  // Calculate metrics for all weeks before current
  const allWeeksMetrics: SectorMetrics[][] = [];
  for (let w = 1; w < currentWeekNumber; w++) {
    allWeeksMetrics.push(calculateSectorMetrics(dailyLogs, w));
  }
  
  // Average across all weeks
  return [
    {
      name: 'Meals',
      daysReached: Math.round(allWeeksMetrics.reduce((sum, m) => sum + m[0].daysReached, 0) / allWeeksMetrics.length),
      totalDays: 7,
      percentage: (allWeeksMetrics.reduce((sum, m) => sum + m[0].daysReached, 0) / allWeeksMetrics.length / 7) * 100,
    },
    {
      name: 'Supplements',
      daysReached: Math.round(allWeeksMetrics.reduce((sum, m) => sum + m[1].daysReached, 0) / allWeeksMetrics.length),
      totalDays: 7,
      percentage: (allWeeksMetrics.reduce((sum, m) => sum + m[1].daysReached, 0) / allWeeksMetrics.length / 7) * 100,
    },
    {
      name: 'Hydration',
      daysReached: Math.round(allWeeksMetrics.reduce((sum, m) => sum + m[2].daysReached, 0) / allWeeksMetrics.length),
      totalDays: 7,
      percentage: (allWeeksMetrics.reduce((sum, m) => sum + m[2].daysReached, 0) / allWeeksMetrics.length / 7) * 100,
    },
    {
      name: 'Movement',
      daysReached: Math.round(allWeeksMetrics.reduce((sum, m) => sum + m[3].daysReached, 0) / allWeeksMetrics.length),
      totalDays: 7,
      percentage: (allWeeksMetrics.reduce((sum, m) => sum + m[3].daysReached, 0) / allWeeksMetrics.length / 7) * 100,
    },
    {
      name: 'Sleep',
      daysReached: Math.round(allWeeksMetrics.reduce((sum, m) => sum + m[4].daysReached, 0) / allWeeksMetrics.length),
      totalDays: 7,
      percentage: (allWeeksMetrics.reduce((sum, m) => sum + m[4].daysReached, 0) / allWeeksMetrics.length / 7) * 100,
    },
  ];
}

export default function WeeklyReflectionPage() {
  const [user, setUser] = useState<any>(null);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // PHASE 2: State for weekly reflection
  const [weeklyNotes, setWeeklyNotes] = useState('');
  const [weeklyWeightEntries, setWeeklyWeightEntries] = useState<{ date: string; weight: number }[]>([]);
  const [newWeightDate, setNewWeightDate] = useState('');
  const [newWeightValue, setNewWeightValue] = useState('');
  
  // PHASE 2: Metrics state
  const [sectorMetrics, setSectorMetrics] = useState<SectorMetrics[]>([]);
  const [winRate, setWinRate] = useState({ winDays: 0, totalDays: 0, percentage: 0 });
  const [weekComparison, setWeekComparison] = useState<any[]>([]);
  const [averageMetrics, setAverageMetrics] = useState<SectorMetrics[]>([]);
  
  // PHASE 2: Share feature state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSummary, setShareSummary] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadAllLogs(user.id);
    }
  }, [user]);

  // PHASE 2: Recalculate metrics when week changes
  useEffect(() => {
    if (allLogs.length > 0) {
      const metrics = calculateSectorMetrics(allLogs, currentWeek);
      setSectorMetrics(metrics);
      
      const win = calculateWinRate(allLogs, currentWeek);
      setWinRate(win);
      
      const prevMetrics = currentWeek > 1 ? calculateSectorMetrics(allLogs, currentWeek - 1) : [];
      const comparison = compareWeeks(metrics, prevMetrics);
      setWeekComparison(comparison);
      
      const avg = calculateAverageMetrics(allLogs, currentWeek);
      setAverageMetrics(avg);
      
      // Load weekly notes and weigh-ins
      loadWeeklyData();
    }
  }, [currentWeek, allLogs]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
    } else {
      setUser(user);
    }
    setLoading(false);
  }

  async function loadAllLogs(userId: string) {
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false });

    if (data) {
      setAllLogs(data as DailyLog[]);
      
      // Set current week to today's week
      const today = new Date();
      const weekNum = getWeekNumber(today);
      setCurrentWeek(Math.max(1, weekNum));
    }
  }

  // PHASE 2: Load weekly notes and weigh-in data from database
  async function loadWeeklyData() {
    if (!user) return;
    
    const { data } = await supabase
      .from('weekly_reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_number', currentWeek)
      .single();
    
    if (data) {
      setWeeklyNotes(data.notes || '');
      setWeeklyWeightEntries(data.weigh_in_entries || []);
    } else {
      setWeeklyNotes('');
      setWeeklyWeightEntries([]);
    }
  }

  // PHASE 2: Save weekly reflection and weigh-ins
  async function saveReflection() {
    if (!user) return;
    setSaving(true);

    try {
      await supabase.from('weekly_reflections').upsert({
        user_id: user.id,
        week_number: currentWeek,
        notes: weeklyNotes,
        weigh_in_entries: weeklyWeightEntries,
        updated_at: new Date().toISOString(),
      });

      showMessage('Weekly reflection saved! ✓', 'success');
    } catch (error: any) {
      showMessage('Error: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // PHASE 2: Add weigh-in entry
  function addWeighIn() {
    if (!newWeightDate || !newWeightValue) {
      showMessage('Please enter both date and weight', 'error');
      return;
    }

    const newEntry = {
      date: newWeightDate,
      weight: parseFloat(newWeightValue),
    };

    setWeeklyWeightEntries([...weeklyWeightEntries, newEntry]);
    setNewWeightDate('');
    setNewWeightValue('');
    showMessage('Weigh-in added! ✓', 'success');
  }

  // PHASE 2: Get weigh-in data with interpolation for continuous trend line
  function getWeighInDataWithInterpolation(): Array<{ date: string; weight?: number; fullDate: string }> {
    if (weeklyWeightEntries.length === 0) return [];
    
    // Build map of actual logged weights
    const logsMap = new Map<string, number>();
    weeklyWeightEntries.forEach(entry => {
      logsMap.set(entry.date, entry.weight);
    });
    
    // Get date range (start of week to end of week)
    const { start, end } = getWeekDateRange(currentWeek);
    const result: Array<{ date: string; weight?: number; fullDate: string }> = [];
    const sortedDates = Array.from(logsMap.keys()).sort();
    
    const current = new Date(start);
    while (current <= end) {
      const dateStr = formatDateForDB(current);
      const actualWeight = logsMap.get(dateStr);
      
      let weight: number | undefined;
      if (actualWeight !== undefined) {
        weight = actualWeight; // Use actual logged weight
      } else {
        // Interpolate between surrounding logged dates
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const nextDate = sortedDates.filter(d => d >= dateStr)[0];
        
        if (prevDate && nextDate) {
          const prevWeight = logsMap.get(prevDate)!;
          const nextWeight = logsMap.get(nextDate)!;
          const prevDateObj = new Date(prevDate);
          const nextDateObj = new Date(nextDate);
          const currentDateObj = new Date(dateStr);
          
          // Linear interpolation
          const totalDays = (nextDateObj.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24);
          const daysPassed = (currentDateObj.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24);
          weight = prevWeight + ((nextWeight - prevWeight) * daysPassed) / totalDays;
        } else if (prevDate) {
          weight = logsMap.get(prevDate)!; // Use last known weight
        } else if (nextDate) {
          weight = logsMap.get(nextDate)!; // Use next known weight
        }
      }
      
      result.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        ...(weight !== undefined && { weight: Math.round(weight * 10) / 10 }), // Round to 1 decimal
        fullDate: dateStr,
      });
      current.setDate(current.getDate() + 1);
    }
    
    return result;
  }

  function showMessage(text: string, type: 'success' | 'error') {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  // PHASE 2: Generate comprehensive weekly summary for sharing
  function generateWeeklySummaryText(): string {
    const lines: string[] = [];
    const divider = '═══════════════════════════';

    // ── HEADER ──
    lines.push(`🌿 *MIMIC GLP-1 - WEEKLY REFLECTION*`);
    lines.push(formatWeekRange(currentWeek));
    lines.push(divider);
    lines.push('');

    // ── WIN RATE ──
    lines.push(`⚡ *WEEKLY WIN RATE*`);
    lines.push(`Days with 4/5 habits: *${winRate.winDays}/${winRate.totalDays}* (${Math.round(winRate.percentage)}%)`);
    lines.push('');

    // ── SECTOR-WISE ANALYSIS ──
    lines.push(`📈 *SECTOR PERFORMANCE*`);
    sectorMetrics.forEach((sector, idx) => {
      const comparison = weekComparison[idx] || {};
      const average = averageMetrics[idx] || { daysReached: 0 };
      const barLength = Math.round(sector.percentage / 10);
      const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
      
      lines.push('');
      lines.push(`*${sector.name}*`);
      lines.push(`   Days: ${sector.daysReached}/${sector.totalDays} (${Math.round(sector.percentage)}%)`);
      lines.push(`   Progress: [${bar}]`);
      
      // Comparison data
      if (comparison.change !== 0) {
        const trend = comparison.trend === 'up' ? '↑' : '↓';
        lines.push(`   vs Last Week: ${comparison.current} vs ${comparison.previous} ${trend}`);
      }
      lines.push(`   vs Average: ${sector.daysReached}/${sector.totalDays} (avg: ${average.daysReached}/${average.totalDays})`);
    });
    lines.push('');

    // ── WEEKLY WEIGH-INS ──
    if (weeklyWeightEntries.length > 0) {
      lines.push(`⚖️ *WEEKLY WEIGH-INS*`);
      const sortedEntries = [...weeklyWeightEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      sortedEntries.forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        lines.push(`   ${date}: ${entry.weight} kg`);
      });
      
      // Calculate weight change
      if (sortedEntries.length > 1) {
        const firstWeight = sortedEntries[0].weight;
        const lastWeight = sortedEntries[sortedEntries.length - 1].weight;
        const change = (lastWeight - firstWeight).toFixed(1);
        const direction = parseFloat(change) < 0 ? '↓ Lost' : parseFloat(change) > 0 ? '↑ Gained' : '= No change';
        lines.push(`   Week change: ${direction} ${Math.abs(parseFloat(change))} kg`);
      }
      lines.push('');
    }

    // ── REFLECTION NOTES ──
    if (weeklyNotes) {
      lines.push(`💭 *WEEKLY REFLECTION NOTES*`);
      lines.push(weeklyNotes);
      lines.push('');
    }

    // ── FOOTER ──
    lines.push(divider);
    lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);

    return lines.join('\n');
  }

  // PHASE 2: Handle share button click
  async function handleWeeklyShare() {
    const summaryText = generateWeeklySummaryText();
    setShareSummary(summaryText);
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(summaryText);
      showMessage('Weekly summary copied to clipboard! ✓', 'success');
    } catch (error) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = summaryText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('Weekly summary copied to clipboard! ✓', 'success');
      } catch (fallbackError) {
        showMessage('Could not copy to clipboard', 'error');
      }
    }
    
    // Show modal
    setShowShareModal(true);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const weekRange = formatWeekRange(currentWeek);
  const { start: weekStart, end: weekEnd } = getWeekDateRange(currentWeek);
  const weekLogsData = allLogs.filter(log => {
    const logDate = new Date(log.log_date);
    return logDate >= weekStart && logDate <= weekEnd;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-96 overflow-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">📋 Weekly Summary</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 whitespace-pre-wrap font-mono text-sm max-w-2xl overflow-auto max-h-80">
              {shareSummary}
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleWeeklyShare}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Share2 size={16} />
                Copy Again
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <div className="bg-black/30 text-white">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold"
            >
              <ChevronLeft size={16} />
              Dashboard
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleWeeklyShare}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold"
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>

          {/* PHASE 2: Prominent week header with dates */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4">
            <div className="text-sm opacity-80 mb-1">Current Week</div>
            <div className="text-3xl font-bold mb-2">{weekRange}</div>
            <div className="text-sm opacity-90">{formatDate(weekStart)} to {formatDate(weekEnd)}</div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg font-semibold ${message.includes('Error') ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'}`}>
            {message}
          </div>
        )}

        {/* Week Navigation */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex items-center gap-3">
          <button
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek === 1}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Prev Week
          </button>
          
          <div className="flex-1 flex items-center justify-center gap-2">
            <input
              type="number"
              value={currentWeek}
              onChange={(e) => setCurrentWeek(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
              max="78"
              className="w-16 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-center font-bold"
            />
            <span className="text-sm text-gray-600">/ 78 weeks</span>
          </div>

          <button
            onClick={() => setCurrentWeek(currentWeek + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
          >
            Next Week
            <ChevronRight size={20} />
          </button>
        </div>

        {/* PHASE 2: WIN RATE DISPLAY */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">⚡ Weekly Win Rate</h2>
            <div className="text-3xl font-bold text-green-600">{Math.round(winRate.percentage)}%</div>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">Days with 4/5 habits completed:</span>
              <span className="text-2xl font-bold text-blue-600">{winRate.winDays}/{winRate.totalDays}</span>
            </div>
            <div className="w-full h-3 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                style={{ width: `${winRate.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">A "win" = 4 or more out of 5 habits completed</p>
          </div>
        </div>

        {/* PHASE 2: SECTOR-WISE ANALYSIS */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Sector Performance</h2>
          
          <div className="space-y-4">
            {sectorMetrics.map((sector, idx) => {
              const comparison = weekComparison[idx] || {};
              const average = averageMetrics[idx] || { daysReached: 0 };
              
              return (
                <div key={sector.name} className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{sector.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-gray-700">{sector.daysReached}/{sector.totalDays} days</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {Math.round(sector.percentage)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {comparison.change !== 0 && (
                        <div className={`flex items-center gap-1 ${comparison.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                          {comparison.trend === 'up' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                          <span className="text-sm font-semibold">
                            {comparison.current} vs {comparison.previous}
                          </span>
                        </div>
                      )}
                      {comparison.change === 0 && (
                        <span className="text-sm text-gray-500">Same as prev</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        sector.percentage >= 80
                          ? 'bg-green-500'
                          : sector.percentage >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${sector.percentage}%` }}
                    />
                  </div>
                  
                  {/* Comparison info */}
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>This week: {sector.daysReached}/{sector.totalDays}</span>
                    <span>Avg: {average.daysReached}/{average.totalDays}</span>
                    <span>
                      {sector.daysReached > average.daysReached
                        ? '↑ Above avg'
                        : sector.daysReached < average.daysReached
                        ? '↓ Below avg'
                        : '= In line'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PHASE 2: WEEKLY WEIGH-IN TRACKER */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚖️ Weekly Weigh-In Tracker</h2>
          
          {/* Add new weigh-in */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Add Weigh-In (Optional)</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={newWeightDate}
                  onChange={(e) => setNewWeightDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newWeightValue}
                  onChange={(e) => setNewWeightValue(e.target.value)}
                  placeholder="Enter weight"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={addWeighIn}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Add
              </button>
            </div>
          </div>

          {/* Weigh-in list and chart */}
          {weeklyWeightEntries.length > 0 ? (
            <>
              {/* Weight trend chart */}
              <div className="mb-6 h-64 bg-gray-50 rounded-lg p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getWeighInDataWithInterpolation()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip 
                      formatter={(value) => `${value} kg`}
                      labelFormatter={(date) => date}
                    />
                    <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Weigh-in entries list */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Entries This Week</h3>
                {weeklyWeightEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <span className="text-sm font-semibold text-gray-700">
                      {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-lg font-bold text-blue-600">{entry.weight} kg</span>
                    <button
                      onClick={() => {
                        setWeeklyWeightEntries(weeklyWeightEntries.filter((_, i) => i !== idx));
                        showMessage('Entry removed', 'success');
                      }}
                      className="text-red-600 hover:text-red-700 text-sm font-semibold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No weigh-in entries yet. Add one to see your weekly trend!</p>
            </div>
          )}
        </div>

        {/* PHASE 2: REFLECTION NOTES */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💭 Weekly Reflection Notes</h2>
          <textarea
            value={weeklyNotes}
            onChange={(e) => setWeeklyNotes(e.target.value)}
            placeholder="How was this week? What went well? What could be improved?"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none text-sm"
            rows={6}
          />
          <p className="text-xs text-gray-500 mt-2">~100 words recommended (1-5 minutes to write)</p>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={saveReflection}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Reflection'}
          </button>
        </div>
      </div>
    </div>
  );
}
