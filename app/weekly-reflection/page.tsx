'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { DailyLog } from '@/lib/types';
import { formatDateForDB } from '@/lib/utils';
import { ChevronLeft, CalendarDays, Save, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface WeeklySummary {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  daysTracked: number;
  movementDays: number;
  mealsAdherence: number;
  weightStart: number | null;
  weightEnd: number | null;
  weightChange: number | null;
  avgHydration: number;
  avgSleep: number;
  supplementsDays: number;
}

interface WeeklyReflection {
  wins: string;
  physical_experience: string;
  nutrition_feedback: string;
  movement_feedback: string;
  challenges: string;
  mental_emotional: string;
  next_week_focus: string;
}

const PROGRAM_START_DATE = new Date('2026-05-22');

export default function WeeklyReflectionPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [reflection, setReflection] = useState<WeeklyReflection>({
    wins: '',
    physical_experience: '',
    nutrition_feedback: '',
    movement_feedback: '',
    challenges: '',
    mental_emotional: '',
    next_week_focus: '',
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadWeeklySummary(user.id, selectedWeek);
    }
  }, [selectedWeek, user]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
    } else {
      setUser(user);
      const currentWeek = getCurrentWeekNumber();
      setSelectedWeek(currentWeek);
      
      // Generate available weeks (Week 1 to current week)
      const weeks = Array.from({ length: currentWeek }, (_, i) => i + 1);
      setAvailableWeeks(weeks);
    }
    setLoading(false);
  }

  function getCurrentWeekNumber(): number {
    const today = new Date();
    const diffTime = today.getTime() - PROGRAM_START_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  function getWeekDates(weekNumber: number): { start: Date; end: Date } {
    const weekStart = new Date(PROGRAM_START_DATE);
    weekStart.setDate(PROGRAM_START_DATE.getDate() + (weekNumber - 1) * 7);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return { start: weekStart, end: weekEnd };
  }

  async function loadWeeklySummary(userId: string, weekNumber: number) {
    const { start, end } = getWeekDates(weekNumber);

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
      const mealsAdherence = logsData.filter(l => l.meals_check).length;
      
      const logsWithWeight = logsData.filter(l => l.weight != null);
      const weightStart: number | null = logsWithWeight.length > 0 ? logsWithWeight[0].weight! : null;
      const weightEnd: number | null = logsWithWeight.length > 0 ? logsWithWeight[logsWithWeight.length - 1].weight! : null;
      const weightChange: number | null = weightStart && weightEnd ? weightEnd - weightStart : null;

      const avgHydration: number = logsData.reduce((acc, l) => acc + l.hydration_items.filter(Boolean).length, 0) / daysTracked;
      const avgSleep: number = logsData.reduce((acc, l) => acc + l.sleep_items.filter(Boolean).length, 0) / daysTracked;
      const supplementsDays = logsData.filter(l => (l.supplements_taken || []).length > 0).length;

      setSummary({
        weekNumber,
        weekStart: formatDateForDB(start),
        weekEnd: formatDateForDB(end),
        daysTracked,
        movementDays,
        mealsAdherence,
        weightStart,
        weightEnd,
        weightChange,
        avgHydration: Math.round(avgHydration * 10) / 10,
        avgSleep: Math.round(avgSleep * 10) / 10,
        supplementsDays,
      });
    } else {
      // No logs for this week
      const { start, end } = getWeekDates(weekNumber);
      setSummary({
        weekNumber,
        weekStart: formatDateForDB(start),
        weekEnd: formatDateForDB(end),
        daysTracked: 0,
        movementDays: 0,
        mealsAdherence: 0,
        weightStart: null,
        weightEnd: null,
        weightChange: null,
        avgHydration: 0,
        avgSleep: 0,
        supplementsDays: 0,
      });
    }

    // Load existing reflection
    await loadExistingReflection(userId, weekNumber);
  }

  async function loadExistingReflection(userId: string, weekNumber: number) {
    const { data } = await supabase
      .from('weekly_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('week_number', weekNumber)
      .single();

    if (data) {
      setReflection({
        wins: data.wins || '',
        physical_experience: data.physical_experience || '',
        nutrition_feedback: data.nutrition_feedback || '',
        movement_feedback: data.movement_feedback || '',
        challenges: data.challenges || '',
        mental_emotional: data.mental_emotional || '',
        next_week_focus: data.next_week_focus || '',
      });
    } else {
      // Reset reflection if no data
      setReflection({
        wins: '',
        physical_experience: '',
        nutrition_feedback: '',
        movement_feedback: '',
        challenges: '',
        mental_emotional: '',
        next_week_focus: '',
      });
    }
  }

  async function saveReflection() {
    if (!user || !summary) return;
    setSaving(true);

    try {
      await supabase.from('weekly_reflections').upsert({
        user_id: user.id,
        week_number: summary.weekNumber,
        week_start_date: summary.weekStart,
        week_end_date: summary.weekEnd,
        days_tracked: summary.daysTracked,
        movement_days: summary.movementDays,
        meals_adherence: summary.mealsAdherence,
        weight_start: summary.weightStart,
        weight_end: summary.weightEnd,
        weight_change: summary.weightChange,
        avg_hydration: summary.avgHydration,
        avg_sleep: summary.avgSleep,
        supplements_days: summary.supplementsDays,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 text-white p-6 md:p-8 shadow-lg">
        <div className="max-w-4xl mx-auto">
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
              <CalendarDays size={40} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold">Weekly Reflection</h1>
              <p className="text-white/80 mt-1">
                {summary && `${new Date(summary.weekStart).toLocaleDateString()} - ${new Date(summary.weekEnd).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Week Selector */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Select Week</h2>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none text-lg font-semibold"
          >
            {availableWeeks.map(week => {
              const { start, end } = getWeekDates(week);
              return (
                <option key={week} value={week}>
                  Week {week} ({start.toLocaleDateString()} - {end.toLocaleDateString()})
                </option>
              );
            })}
          </select>
        </div>

        {/* Data Summary */}
        {summary && summary.daysTracked > 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Week {summary.weekNumber} Summary</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Days Tracked</div>
                <div className="text-2xl font-bold text-indigo-600">{summary.daysTracked}/7</div>
              </div>
              <div className="bg-pink-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Movement Days</div>
                <div className="text-2xl font-bold text-pink-600">{summary.movementDays}/7</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Meals Target Met</div>
                <div className="text-2xl font-bold text-green-600">{summary.mealsAdherence}/7</div>
              </div>
              <div className="bg-cyan-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Avg Hydration</div>
                <div className="text-2xl font-bold text-cyan-600">{summary.avgHydration}L</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Avg Sleep</div>
                <div className="text-2xl font-bold text-purple-600">{summary.avgSleep}h</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Supplements</div>
                <div className="text-2xl font-bold text-orange-600">{summary.supplementsDays}/7</div>
              </div>
            </div>

            {summary.weightStart && summary.weightEnd && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-600 mb-1">Weight Progress</div>
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
          </div>
        ) : (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
            <p className="text-yellow-900 font-semibold">No daily logs found for Week {selectedWeek}. Complete some daily logs first!</p>
          </div>
        )}

        {/* Reflection Questions */}
        <div className="space-y-6">
          {/* Question 1 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🎉 Wins This Week</h3>
            <p className="text-sm text-gray-600 mb-3">What went really well this week? What's one thing you're most proud of?</p>
            <textarea
              value={reflection.wins}
              onChange={(e) => setReflection({ ...reflection, wins: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Share your wins..."
            />
          </div>

          {/* Question 2 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">💪 Physical Experience</h3>
            <p className="text-sm text-gray-600 mb-3">How did your body feel? (energy, hunger, cravings, sleep quality)</p>
            <textarea
              value={reflection.physical_experience}
              onChange={(e) => setReflection({ ...reflection, physical_experience: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Describe your physical experience..."
            />
          </div>

          {/* Question 3 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🍽️ Nutrition & Protocol</h3>
            <p className="text-sm text-gray-600 mb-3">How was meal adherence? Any cravings or challenges with the protocol?</p>
            <textarea
              value={reflection.nutrition_feedback}
              onChange={(e) => setReflection({ ...reflection, nutrition_feedback: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Share your nutrition experience..."
            />
          </div>

          {/* Question 4 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🏃 Movement & Activity</h3>
            <p className="text-sm text-gray-600 mb-3">How did movement/exercise feel this week? Energy levels during workouts?</p>
            <textarea
              value={reflection.movement_feedback}
              onChange={(e) => setReflection({ ...reflection, movement_feedback: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Reflect on your movement..."
            />
          </div>

          {/* Question 5 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">😓 Challenges & Obstacles</h3>
            <p className="text-sm text-gray-600 mb-3">What was difficult? Any slip-ups? What triggered challenges?</p>
            <textarea
              value={reflection.challenges}
              onChange={(e) => setReflection({ ...reflection, challenges: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Share your challenges honestly..."
            />
          </div>

          {/* Question 6 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🧠 Mental & Emotional</h3>
            <p className="text-sm text-gray-600 mb-3">How was your mindset? Stress levels, mood, motivation?</p>
            <textarea
              value={reflection.mental_emotional}
              onChange={(e) => setReflection({ ...reflection, mental_emotional: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Reflect on your mental state..."
            />
          </div>

          {/* Question 7 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🎯 Focus for Next Week</h3>
            <p className="text-sm text-gray-600 mb-3">What's ONE thing to focus on improving? Any adjustments needed?</p>
            <textarea
              value={reflection.next_week_focus}
              onChange={(e) => setReflection({ ...reflection, next_week_focus: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
              rows={4}
              placeholder="Set your focus for next week..."
            />
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={saveReflection}
          disabled={saving}
          className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 px-6 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : `Save Week ${summary?.weekNumber} Reflection`}
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
