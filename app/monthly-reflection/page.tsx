'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { DailyLog } from '@/lib/types';
import { formatDateForDB } from '@/lib/utils';
import { ChevronLeft, CalendarRange, Save, TrendingDown, TrendingUp, Minus, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';

interface MonthlySummary {
  monthNumber: number;
  monthStart: string;
  daysTracked: number;
  movementDays: number;
  protocolAdherence: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightChange: number | null;
  bestWeekStart: string | null;
}

interface MonthlyReflection {
  big_picture_progress: string;
  data_patterns: string;
  physical_transformation: string;
  mental_shifts: string;
  whats_working: string;
  whats_not_working: string;
  next_month_goals: string;
  free_reflection: string;
}

interface UserGoals {
  initial_weight: number | null;
  goal_weight_min: number | null;
  goal_weight_max: number | null;
}

const PROGRAM_START_DATE = new Date('2026-05-22');

export default function MonthlyReflectionPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [availableMonths, setAvailableMonths] = useState<number[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [goals, setGoals] = useState<UserGoals>({ initial_weight: null, goal_weight_min: null, goal_weight_max: null });
  const [chartData, setChartData] = useState<any[]>([]);
  const [reflection, setReflection] = useState<MonthlyReflection>({
    big_picture_progress: '',
    data_patterns: '',
    physical_transformation: '',
    mental_shifts: '',
    whats_working: '',
    whats_not_working: '',
    next_month_goals: '',
    free_reflection: '',
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadMonthlySummary(user.id, selectedMonth);
    }
  }, [selectedMonth, user]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
    } else {
      setUser(user);
      await loadUserGoals(user.id);
      
      const currentMonth = getCurrentMonthNumber();
      setSelectedMonth(currentMonth);
      
      // Generate available months
      const months = Array.from({ length: currentMonth }, (_, i) => i + 1);
      setAvailableMonths(months);
    }
    setLoading(false);
  }

  async function loadUserGoals(userId: string) {
    const { data } = await supabase
      .from('user_preferences')
      .select('initial_weight, goal_weight_min, goal_weight_max')
      .eq('user_id', userId)
      .single();

    if (data) {
      setGoals({
        initial_weight: data.initial_weight,
        goal_weight_min: data.goal_weight_min,
        goal_weight_max: data.goal_weight_max,
      });
    }
  }

  function getCurrentMonthNumber(): number {
    const today = new Date();
    const diffTime = today.getTime() - PROGRAM_START_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 30) + 1;
  }

  function getMonthDates(monthNumber: number): { start: Date; end: Date } {
    const monthStart = new Date(PROGRAM_START_DATE);
    monthStart.setDate(PROGRAM_START_DATE.getDate() + (monthNumber - 1) * 30);
    
    const monthEnd = new Date(monthStart);
    monthEnd.setDate(monthStart.getDate() + 29);
    
    return { start: monthStart, end: monthEnd };
  }

  async function loadMonthlySummary(userId: string, monthNumber: number) {
    const { start, end } = getMonthDates(monthNumber);

    const { data: logs } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', formatDateForDB(start))
      .lte('log_date', formatDateForDB(end))
      .order('log_date', { ascending: true });

    if (logs && logs.length > 0) {
      const logsData = logs as DailyLog[];
      
      const daysTracked = logsData.length;
      const movementDays = logsData.filter(l => l.movement_check).length;
      const mealsCheck = logsData.filter(l => l.meals_check).length;
      const movementCheck = logsData.filter(l => l.movement_check).length;
      const protocolAdherence = Math.round(((mealsCheck + movementCheck) / (daysTracked * 2)) * 100);

      const logsWithWeight = logsData.filter(l => l.weight != null);
      const weightStart: number | null = logsWithWeight.length > 0 ? logsWithWeight[0].weight! : null;
      const weightEnd: number | null = logsWithWeight.length > 0 ? logsWithWeight[logsWithWeight.length - 1].weight! : null;
      const weightChange: number | null = weightStart && weightEnd ? weightEnd - weightStart : null;

      // Find best week
      let bestWeekStart: string | null = null;
      let bestWeekScore = 0;
      
      for (let i = 0; i <= logsData.length - 7; i++) {
        const weekLogs = logsData.slice(i, i + 7);
        const score = weekLogs.filter(l => l.meals_check && l.movement_check).length;
        if (score > bestWeekScore) {
          bestWeekScore = score;
          bestWeekStart = weekLogs[0].log_date;
        }
      }

      setSummary({
        monthNumber,
        monthStart: formatDateForDB(start),
        daysTracked,
        movementDays,
        protocolAdherence,
        weightStart,
        weightEnd,
        weightChange,
        bestWeekStart,
      });

      // Build chart data
      await buildChartData(userId, monthNumber, logsWithWeight);
    } else {
      const { start } = getMonthDates(monthNumber);
      setSummary({
        monthNumber,
        monthStart: formatDateForDB(start),
        daysTracked: 0,
        movementDays: 0,
        protocolAdherence: 0,
        weightStart: null,
        weightEnd: null,
        weightChange: null,
        bestWeekStart: null,
      });
      setChartData([]);
    }

    await loadExistingReflection(userId, monthNumber);
  }

  async function buildChartData(userId: string, monthNumber: number, monthLogs: DailyLog[]) {
    // Get ALL logs from Day 1 to end of selected month for complete chart
    const { end } = getMonthDates(monthNumber);
    
    const { data: allLogs } = await supabase
      .from('daily_logs')
      .select('log_date, weight')
      .eq('user_id', userId)
      .gte('log_date', formatDateForDB(PROGRAM_START_DATE))
      .lte('log_date', formatDateForDB(end))
      .order('log_date', { ascending: true });

    if (allLogs && allLogs.length > 0) {
      const logsWithWeight = allLogs.filter(l => l.weight != null) as DailyLog[];
      
      const data = logsWithWeight.map((log, index) => ({
        day: index + 1,
        weight: log.weight!,
        goalMin: goals.goal_weight_min,
        goalMax: goals.goal_weight_max,
      }));

      setChartData(data);
    }
  }

  async function loadExistingReflection(userId: string, monthNumber: number) {
    const { data } = await supabase
      .from('monthly_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('month_number', monthNumber)
      .single();

    if (data) {
      setReflection({
        big_picture_progress: data.big_picture_progress || '',
        data_patterns: data.data_patterns || '',
        physical_transformation: data.physical_transformation || '',
        mental_shifts: data.mental_shifts || '',
        whats_working: data.whats_working || '',
        whats_not_working: data.whats_not_working || '',
        next_month_goals: data.next_month_goals || '',
        free_reflection: data.free_reflection || '',
      });
    } else {
      setReflection({
        big_picture_progress: '',
        data_patterns: '',
        physical_transformation: '',
        mental_shifts: '',
        whats_working: '',
        whats_not_working: '',
        next_month_goals: '',
        free_reflection: '',
      });
    }
  }

  async function saveReflection() {
    if (!user || !summary) return;
    setSaving(true);

    try {
      await supabase.from('monthly_reflections').upsert({
        user_id: user.id,
        month_number: summary.monthNumber,
        month_start_date: summary.monthStart,
        days_tracked: summary.daysTracked,
        movement_days: summary.movementDays,
        protocol_adherence: summary.protocolAdherence,
        weight_start: summary.weightStart,
        weight_end: summary.weightEnd,
        weight_change: summary.weightChange,
        best_week_start: summary.bestWeekStart,
        ...reflection,
      });

      showMessage('Reflection saved successfully! ✓', 'success');
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

  function calculateProgress() {
    if (!goals.initial_weight || !goals.goal_weight_min || !summary?.weightEnd) return null;
    
    const totalLossNeeded = goals.initial_weight - goals.goal_weight_min;
    const currentLoss = goals.initial_weight - summary.weightEnd;
    const progress = (currentLoss / totalLossNeeded) * 100;
    
    return {
      progress: Math.round(progress),
      remaining: goals.goal_weight_min - summary.weightEnd,
      completed: currentLoss,
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  const progress = calculateProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-pink-500 via-pink-600 to-purple-600 text-white p-6 md:p-8 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <ChevronLeft size={18} />
              Dashboard
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
              <CalendarRange size={40} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Monthly Reflection</h1>
              <p className="text-white/80 mt-1">Month {selectedMonth} Review</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Month Selector */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Select Month</h2>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none text-lg font-semibold"
          >
            {availableMonths.map(month => {
              const { start, end } = getMonthDates(month);
              return (
                <option key={month} value={month}>
                  Month {month} ({start.toLocaleDateString()} - {end.toLocaleDateString()})
                </option>
              );
            })}
          </select>
        </div>

        {/* Goal Progress */}
        {goals.initial_weight && goals.goal_weight_min && summary && summary.weightEnd && progress && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-green-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">🎯 Goal Progress</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Starting Weight:</span>
                    <span className="font-bold text-gray-900">{goals.initial_weight} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Current Weight:</span>
                    <span className="font-bold text-green-700">{summary.weightEnd} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Minimum Goal:</span>
                    <span className="font-bold text-indigo-700">{goals.goal_weight_min} kg</span>
                  </div>
                  {goals.goal_weight_max && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Secondary Goal:</span>
                      <span className="font-bold text-purple-700">{goals.goal_weight_max} kg</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex justify-between">
                  <span className="text-sm font-semibold text-gray-700">Progress to Goal:</span>
                  <span className="text-sm font-bold text-green-600">{progress.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${Math.min(progress.progress, 100)}%` }}
                  >
                    {progress.progress >= 10 && (
                      <span className="text-xs font-bold text-white">{progress.progress}%</span>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Weight Lost:</span>
                    <span className="font-bold text-green-600">{progress.completed.toFixed(1)} kg</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Remaining to Goal:</span>
                    <span className="font-bold text-orange-600">{Math.abs(progress.remaining).toFixed(1)} kg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Weight Progress Chart */}
        {chartData.length > 0 && goals.initial_weight && goals.goal_weight_min && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📈 Weight Progress Chart</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                
                {/* Goal lines */}
                <ReferenceLine y={goals.initial_weight} stroke="#94a3b8" strokeDasharray="3 3" label="Start" />
                <ReferenceLine y={goals.goal_weight_min} stroke="#22c55e" strokeWidth={2} label="Min Goal" />
                {goals.goal_weight_max && (
                  <ReferenceLine y={goals.goal_weight_max} stroke="#a855f7" strokeWidth={2} label="Max Goal" />
                )}
                
                {/* Actual weight line */}
                <Line type="monotone" dataKey="weight" stroke="#ec4899" strokeWidth={3} dot={{ r: 2 }} name="Your Weight" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data Summary */}
        {summary && summary.daysTracked > 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Month {summary.monthNumber} Summary</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Days Tracked</div>
                <div className="text-2xl font-bold text-indigo-600">{summary.daysTracked}/30</div>
              </div>
              <div className="bg-pink-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Movement Days</div>
                <div className="text-2xl font-bold text-pink-600">{summary.movementDays}/30</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Protocol Adherence</div>
                <div className="text-2xl font-bold text-green-600">{summary.protocolAdherence}%</div>
              </div>
            </div>

            {summary.weightStart && summary.weightEnd && (
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">Weight Progress (30 Days)</div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg text-gray-700">{summary.weightStart} kg</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-lg font-bold text-gray-900">{summary.weightEnd} kg</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {summary.weightChange && (
                      <>
                        {summary.weightChange < 0 ? (
                          <TrendingDown className="text-green-600" size={24} />
                        ) : summary.weightChange > 0 ? (
                          <TrendingUp className="text-red-600" size={24} />
                        ) : (
                          <Minus className="text-gray-400" size={24} />
                        )}
                        <span className={`text-2xl font-bold ${
                          summary.weightChange < 0 ? 'text-green-600' : 
                          summary.weightChange > 0 ? 'text-red-600' : 
                          'text-gray-400'
                        }`}>
                          {summary.weightChange > 0 ? '+' : ''}{summary.weightChange.toFixed(1)} kg
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {summary.bestWeekStart && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-600 mb-1">🏆 Best Week</div>
                <div className="text-lg font-bold text-yellow-700">
                  Week starting {new Date(summary.bestWeekStart).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
            <p className="text-yellow-900 font-semibold">No daily logs found for Month {selectedMonth}. Complete some daily logs first!</p>
          </div>
        )}

        {/* Reflection Questions */}
        <div className="space-y-6">
          {/* Question 1 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🎯 Big Picture Progress</h3>
            <p className="text-sm text-gray-600 mb-3">Looking back 30 days, what's the biggest win? How do you feel compared to Day 1?</p>
            <textarea
              value={reflection.big_picture_progress}
              onChange={(e) => setReflection({ ...reflection, big_picture_progress: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Reflect on your overall progress..."
            />
          </div>

          {/* Question 2 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">📊 Data Patterns</h3>
            <p className="text-sm text-gray-600 mb-3">What patterns do you notice? Best days vs. tough days - what's different?</p>
            <textarea
              value={reflection.data_patterns}
              onChange={(e) => setReflection({ ...reflection, data_patterns: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Share patterns you've noticed..."
            />
          </div>

          {/* Question 3 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🧬 Physical Transformation</h3>
            <p className="text-sm text-gray-600 mb-3">Body composition changes? Energy, stamina, strength? How do you FEEL in your body?</p>
            <textarea
              value={reflection.physical_transformation}
              onChange={(e) => setReflection({ ...reflection, physical_transformation: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Describe your physical changes..."
            />
          </div>

          {/* Question 4 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🧠 Mental Shifts</h3>
            <p className="text-sm text-gray-600 mb-3">Has your relationship with food changed? Mindset shifts around health/discipline?</p>
            <textarea
              value={reflection.mental_shifts}
              onChange={(e) => setReflection({ ...reflection, mental_shifts: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Reflect on mental changes..."
            />
          </div>

          {/* Question 5 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">✅ What's Working</h3>
            <p className="text-sm text-gray-600 mb-3">Which protocol elements work best for you? What makes adherence easy?</p>
            <textarea
              value={reflection.whats_working}
              onChange={(e) => setReflection({ ...reflection, whats_working: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="List what's working well..."
            />
          </div>

          {/* Question 6 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">⚠️ What's Not Working</h3>
            <p className="text-sm text-gray-600 mb-3">What consistently challenges you? Any parts feel unsustainable?</p>
            <textarea
              value={reflection.whats_not_working}
              onChange={(e) => setReflection({ ...reflection, whats_not_working: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Be honest about challenges..."
            />
          </div>

          {/* Question 7 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🎯 Next 30 Days</h3>
            <p className="text-sm text-gray-600 mb-3">What's your main goal? What will you keep/change? How will you measure success?</p>
            <textarea
              value={reflection.next_month_goals}
              onChange={(e) => setReflection({ ...reflection, next_month_goals: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Set your goals for next month..."
            />
          </div>

          {/* Question 8 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">📝 Free Reflection</h3>
            <p className="text-sm text-gray-600 mb-3">Anything else on your mind? Learnings, insights, or thoughts?</p>
            <textarea
              value={reflection.free_reflection}
              onChange={(e) => setReflection({ ...reflection, free_reflection: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Share any additional thoughts..."
            />
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={saveReflection}
          disabled={saving}
          className="w-full mt-6 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:from-pink-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : `Save Month ${summary?.monthNumber} Reflection`}
        </button>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl font-semibold ${
          message.includes('Error') ? 'bg-red-500' : 'bg-green-500'
        } text-white z-50`}>
          {message}
        </div>
      )}
    </div>
  );
}
