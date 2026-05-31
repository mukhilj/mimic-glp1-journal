'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { DailyLog } from '@/lib/types';
import { formatDateForDB, formatDate } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Save, Share2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, AreaChart } from 'recharts';

const PROGRAM_START_DATE = new Date('2026-06-01');

// Get current month as YYYY-MM
function getCurrentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get month dates (1st to last day)
function getMonthDates(monthString: string): { start: Date; end: Date } {
  const [year, month] = monthString.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Last day of month
  return { start, end };
}

// Format month like "June 2026"
function formatMonthDisplay(monthString: string): string {
  const [year, month] = monthString.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Format month with dates like "June 2026 (Jun 1-30)"
function formatMonthWithDates(monthString: string): string {
  const { start, end } = getMonthDates(monthString);
  const monthName = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = start.getFullYear();
  const fullMonth = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  return `${fullMonth} (${monthName} ${startDay}-${endDay})`;
}

export default function MonthlyReflectionPage() {
  const [user, setUser] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString());
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // PHASE 3: Monthly reflection state
  const [mentorWord, setMentorWord] = useState('');
  const [mentorWordReflection, setMentorWordReflection] = useState('');
  const [reflectionNotes, setReflectionNotes] = useState('');
  const [userPreferences, setUserPreferences] = useState<any>(null);
  
  // PHASE 3: Share state
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
      loadUserPreferences(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadMonthlyReflection();
    }
  }, [currentMonth, user]);

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
    }
  }

  async function loadUserPreferences(userId: string) {
    const { data } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      setUserPreferences(data);
    }
  }

  async function loadMonthlyReflection() {
    if (!user) return;
    
    const [year, month] = currentMonth.split('-').map(Number);
    const monthNum = month;
    
    const { data } = await supabase
      .from('monthly_reflections')
      .select('*')
      .eq('user_id', user.id)
      .eq('month_number', monthNum)
      .eq('year', year)
      .single();
    
    if (data) {
      setMentorWord(data.mentor_word || '');
      setMentorWordReflection(data.mentor_word_reflection || '');
      setReflectionNotes(data.notes || '');
    } else {
      setMentorWord('');
      setMentorWordReflection('');
      setReflectionNotes('');
    }
  }

  // PHASE 3: Get weight data for the month - FIXED: Include ALL dates with interpolation for continuous line
  function getMonthWeightData(): Array<{ date: string; weight?: number; fullDate: string }> {
    const { start, end } = getMonthDates(currentMonth);
    const logsMap = new Map<string, number>();
    
    // Build map of dates with actual logged weight
    allLogs
      .filter(log => {
        const logDate = new Date(log.log_date);
        return logDate >= start && logDate <= end && log.weight;
      })
      .forEach(log => {
        logsMap.set(log.log_date, log.weight!);
      });
    
    // Generate all dates in range with interpolated values
    const result: Array<{ date: string; weight?: number; fullDate: string }> = [];
    const current = new Date(start);
    const sortedDates = Array.from(logsMap.keys()).sort();
    
    while (current <= end) {
      const dateStr = formatDateForDB(current);
      const actualWeight = logsMap.get(dateStr);
      
      let weight: number | undefined;
      if (actualWeight !== undefined) {
        weight = actualWeight; // Use actual logged weight
      } else {
        // Interpolate: find surrounding logged dates
        const surroundingDates = sortedDates.filter(d => d >= dateStr);
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const nextDate = surroundingDates[0];
        
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

  // PHASE 3: Get all weight data since start - FIXED: Include interpolation for continuous line
  function getAllWeightData(): Array<{ date: string; weight?: number; fullDate: string }> {
    const logsMap = new Map<string, number>();
    
    // Build map of dates with actual logged weight
    allLogs
      .filter(log => log.weight)
      .forEach(log => {
        logsMap.set(log.log_date, log.weight!);
      });
    
    // Generate all dates from program start to most recent log with interpolated values
    const result: Array<{ date: string; weight?: number; fullDate: string }> = [];
    const start = new Date(PROGRAM_START_DATE);
    const end = new Date();
    
    const sortedDates = Array.from(logsMap.keys()).sort();
    const current = new Date(start);
    
    while (current <= end) {
      const dateStr = formatDateForDB(current);
      const actualWeight = logsMap.get(dateStr);
      
      let weight: number | undefined;
      if (actualWeight !== undefined) {
        weight = actualWeight; // Use actual logged weight
      } else {
        // Interpolate: find surrounding logged dates
        const surroundingDates = sortedDates.filter(d => d >= dateStr);
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const nextDate = surroundingDates[0];
        
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

  // PHASE 3: Calculate goal progress
  function calculateGoalProgress() {
    if (!userPreferences || !userPreferences.initial_weight) {
      return { current: 0, goal: 0, lost: 0, remaining: 0, percentage: 0 };
    }

    const initial = userPreferences.initial_weight;
    const goalMin = userPreferences.goal_weight_min || initial * 0.85; // Default: 15% loss
    // FIX: Use [0] instead of .pop() because logs are in descending order (most recent first)
    // .pop() gets the OLDEST, [0] gets the NEWEST (most recent)
    const current = allLogs.filter(l => l.weight)[0]?.weight || initial;
    
    const lost = initial - current;
    const totalGoal = initial - goalMin;
    const percentage = totalGoal > 0 ? (lost / totalGoal) * 100 : 0;
    
    return {
      current,
      goal: goalMin,
      lost: Math.max(0, lost),
      remaining: Math.max(0, current - goalMin),
      percentage: Math.min(100, Math.max(0, percentage)),
    };
  }

  // PHASE 3: Generate comprehensive monthly summary
  function generateMonthlySummaryText(): string {
    const lines: string[] = [];
    const divider = '═══════════════════════════';
    const monthlyData = getMonthWeightData();
    const allData = getAllWeightData();
    const goalProgress = calculateGoalProgress();

    // ── HEADER ──
    lines.push(`🌿 *MIMIC GLP-1 - MONTHLY REFLECTION*`);
    lines.push(formatMonthWithDates(currentMonth));
    lines.push(divider);
    lines.push('');

    // ── GOAL PROGRESS ──
    lines.push(`🎯 *GOAL PROGRESS*`);
    lines.push(`Current Weight: *${goalProgress.current.toFixed(1)} kg*`);
    lines.push(`Goal Weight: ${goalProgress.goal.toFixed(1)} kg`);
    lines.push(`Lost This Phase: *${goalProgress.lost.toFixed(1)} kg* (${Math.round(goalProgress.percentage)}%)`);
    lines.push(`Remaining to Goal: ${goalProgress.remaining.toFixed(1)} kg`);
    lines.push('');

    // ── MONTHLY WEIGHT JOURNEY ──
    if (monthlyData.length > 0) {
      lines.push(`📈 *THIS MONTH'S WEIGHT JOURNEY*`);
      monthlyData.forEach((entry, idx) => {
        const date = new Date(entry.fullDate).toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
        lines.push(`   ${date}: ${entry.weight} kg`);
      });
      
      if (monthlyData.length > 1) {
        const first = monthlyData[0]?.weight;
        const last = monthlyData[monthlyData.length - 1]?.weight;
        if (first && last) {
          const monthChange = (first - last).toFixed(1);
          const direction = parseFloat(monthChange) > 0 ? '↓ Lost' : parseFloat(monthChange) < 0 ? '↑ Gained' : '= No change';
          lines.push(`   Month change: ${direction} ${Math.abs(parseFloat(monthChange))} kg`);
        }
      }
      lines.push('');
    }

    // ── OVERALL JOURNEY ──
    if (allData.length > 0) {
      const startWeight = allData[0]?.weight;
      const currentWeight = allData[allData.length - 1]?.weight;
      if (startWeight && currentWeight) {
        const totalLoss = (startWeight - currentWeight).toFixed(1);
        lines.push(`🚀 *OVERALL JOURNEY (SINCE START)*`);
        lines.push(`   Start: ${startWeight} kg`);
        lines.push(`   Current: ${currentWeight} kg`);
        lines.push(`   Total Loss: ${totalLoss} kg`);
        lines.push(`   Duration: ${allData.length} days tracked`);
        lines.push('');
      }
    }

    // ── MENTOR'S WORD REFLECTION ──
    if (mentorWord) {
      lines.push(`💭 *MENTOR'S WORD: "${mentorWord}"*`);
      if (mentorWordReflection) {
        lines.push(mentorWordReflection);
      }
      lines.push('');
    }

    // ── OTHER REFLECTIONS ──
    if (reflectionNotes) {
      lines.push(`📝 *MONTHLY REFLECTIONS*`);
      lines.push(reflectionNotes);
      lines.push('');
    }

    // ── FOOTER ──
    lines.push(divider);
    lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`);

    return lines.join('\n');
  }

  // PHASE 3: Handle share button
  async function handleMonthlyShare() {
    const summaryText = generateMonthlySummaryText();
    setShareSummary(summaryText);
    
    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(summaryText);
      showMessage('Monthly summary copied to clipboard! ✓', 'success');
    } catch (error) {
      // Fallback
      try {
        const textArea = document.createElement('textarea');
        textArea.value = summaryText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('Monthly summary copied to clipboard! ✓', 'success');
      } catch (fallbackError) {
        showMessage('Could not copy to clipboard', 'error');
      }
    }
    
    setShowShareModal(true);
  }

  async function saveReflection() {
    if (!user) return;
    setSaving(true);

    try {
      const [year, month] = currentMonth.split('-').map(Number);
      
      await supabase.from('monthly_reflections').upsert({
        user_id: user.id,
        year,
        month_number: month,
        mentor_word: mentorWord,
        mentor_word_reflection: mentorWordReflection,
        notes: reflectionNotes,
        updated_at: new Date().toISOString(),
      });

      showMessage('Monthly reflection saved! ✓', 'success');
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const monthlyWeightData = getMonthWeightData();
  const allWeightData = getAllWeightData();
  const goalProgress = calculateGoalProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-red-500">
      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-96 overflow-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold">📋 Monthly Summary</h3>
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
                onClick={handleMonthlyShare}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
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
                onClick={handleMonthlyShare}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold"
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>

          {/* PHASE 3: Prominent month display with dates */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4">
            <div className="text-sm opacity-80 mb-1">Current Month</div>
            <div className="text-3xl font-bold mb-2">{formatMonthDisplay(currentMonth)}</div>
            <div className="text-sm opacity-90">{formatMonthWithDates(currentMonth)}</div>
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

        {/* Month Navigation */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex items-center gap-3">
          <button
            onClick={() => {
              const [year, month] = currentMonth.split('-').map(Number);
              const prevMonth = month === 1 ? 12 : month - 1;
              const prevYear = month === 1 ? year - 1 : year;
              setCurrentMonth(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            Prev Month
          </button>
          
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-center font-bold"
          />

          <button
            onClick={() => {
              const [year, month] = currentMonth.split('-').map(Number);
              const nextMonth = month === 12 ? 1 : month + 1;
              const nextYear = month === 12 ? year + 1 : year;
              setCurrentMonth(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center gap-2"
          >
            Next Month
            <ChevronRight size={20} />
          </button>
        </div>

        {/* PHASE 3: Goal Progress */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🎯 Goal Progress</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Current Weight</div>
              <div className="text-3xl font-bold text-blue-600">{goalProgress.current.toFixed(1)} kg</div>
            </div>
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Goal Weight</div>
              <div className="text-3xl font-bold text-green-600">{goalProgress.goal.toFixed(1)} kg</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">Progress to Goal:</span>
              <span className="text-2xl font-bold text-purple-600">{Math.round(goalProgress.percentage)}%</span>
            </div>
            <div className="w-full h-4 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${goalProgress.percentage}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Lost: </span>
                <span className="font-bold text-green-600">{goalProgress.lost.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-gray-600">Remaining: </span>
                <span className="font-bold text-orange-600">{goalProgress.remaining.toFixed(1)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* PHASE 3: Monthly Weight Journey Chart */}
        {monthlyWeightData.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 This Month's Weight Journey</h2>
            <div className="h-64 bg-gray-50 rounded-lg p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyWeightData}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip 
                    formatter={(value) => `${value} kg`}
                    contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }}
                  />
                  <Area type="monotone" dataKey="weight" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorWeight)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* PHASE 3: Overall Journey Chart */}
        {allWeightData.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 Overall Journey (Since Start)</h2>
            <div className="h-64 bg-gray-50 rounded-lg p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={allWeightData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip 
                    formatter={(value) => `${value} kg`}
                    contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#ec4899" strokeWidth={2} dot={{ fill: '#ec4899', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {allWeightData.length > 1 && (
              <div className="mt-4 p-4 bg-pink-50 border-2 border-pink-200 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Start: </span>
                    <span className="font-bold">{allWeightData[0]?.weight || 'N/A'} kg</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Current: </span>
                    <span className="font-bold">{allWeightData[allWeightData.length - 1]?.weight || 'N/A'} kg</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Loss: </span>
                    <span className="font-bold text-green-600">
                      {(
                        (allWeightData[0]?.weight || 0) - (allWeightData[allWeightData.length - 1]?.weight || 0)
                      ).toFixed(1)}{' '}
                      kg
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PHASE 3: Mentor's Word - PRIORITY SECTION */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-4 border-purple-500">
          <h2 className="text-xl font-bold text-purple-900 mb-4">💭 Mentor's Word & Reflection</h2>
          <p className="text-sm text-gray-600 mb-3 italic">This month's mentor-provided word:</p>
          
          <input
            type="text"
            value={mentorWord}
            onChange={(e) => setMentorWord(e.target.value)}
            placeholder="Enter the mentor's word for this month..."
            className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none font-bold text-lg mb-4"
          />
          
          <label className="block text-sm font-semibold text-gray-700 mb-2">Reflect on this word:</label>
          <textarea
            value={mentorWordReflection}
            onChange={(e) => setMentorWordReflection(e.target.value)}
            placeholder="How did this word apply to your month? What does it mean to you?"
            className="w-full px-4 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none text-sm"
            rows={4}
          />
        </div>

        {/* PHASE 3: Other Reflections */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Monthly Reflection Notes</h2>
          <textarea
            value={reflectionNotes}
            onChange={(e) => setReflectionNotes(e.target.value)}
            placeholder="How was this month overall? Key learnings, challenges, wins?"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none text-sm"
            rows={6}
          />
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
