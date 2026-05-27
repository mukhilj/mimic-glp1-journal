'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Target, Save } from 'lucide-react';

interface UserGoals {
  start_date: string;
  initial_weight: number | null;
  goal_weight_min: number | null;
  goal_weight_max: number | null;
}

export default function GoalsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [goals, setGoals] = useState<UserGoals>({
    start_date: '2026-05-22',
    initial_weight: null,
    goal_weight_min: null,
    goal_weight_max: null,
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
    } else {
      setUser(user);
      await loadGoals(user.id);
    }
    setLoading(false);
  }

  async function loadGoals(userId: string) {
    const { data } = await supabase
      .from('user_preferences')
      .select('start_date, initial_weight, goal_weight_min, goal_weight_max')
      .eq('user_id', userId)
      .single();

    if (data) {
      setGoals({
        start_date: data.start_date || '2026-05-22',
        initial_weight: data.initial_weight,
        goal_weight_min: data.goal_weight_min,
        goal_weight_max: data.goal_weight_max,
      });
    }
  }

  async function saveGoals() {
    if (!user) return;
    
    // Validation
    if (!goals.initial_weight || !goals.goal_weight_min) {
      showMessage('Please enter at least initial weight and minimum goal!', 'error');
      return;
    }

    if (goals.goal_weight_min >= goals.initial_weight) {
      showMessage('Goal weight must be less than initial weight!', 'error');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          start_date: goals.start_date,
          initial_weight: goals.initial_weight,
          goal_weight_min: goals.goal_weight_min,
          goal_weight_max: goals.goal_weight_max,
        });

      if (error) throw error;

      showMessage('Goals saved successfully! ✓', 'success');
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

  function calculateLossPercentage() {
    if (!goals.initial_weight || !goals.goal_weight_min) return null;
    return Math.round(((goals.initial_weight - goals.goal_weight_min) / goals.initial_weight) * 100);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  const lossPercentage = calculateLossPercentage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 text-white p-6 md:p-8 shadow-lg">
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
              <Target size={40} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Goals & Targets</h1>
              <p className="text-white/80 mt-1">Set your weight loss journey goals</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8">
        {/* Info Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-900 text-sm">
            <strong>Program Timeline:</strong> May 22, 2026 → Dec 31, 2027 (18 months)
          </p>
        </div>

        {/* Goals Form */}
        <div className="space-y-6">
          {/* Initial Weight */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">⚖️ Starting Weight</h3>
            <p className="text-sm text-gray-600 mb-3">What was your weight on Day 1 (May 22, 2026)?</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                value={goals.initial_weight || ''}
                onChange={(e) => setGoals({ ...goals, initial_weight: parseFloat(e.target.value) || null })}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-lg font-semibold"
                placeholder="Enter starting weight"
              />
              <span className="text-gray-600 font-semibold">kg</span>
            </div>
          </div>

          {/* Minimum Goal */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🎯 Minimum Goal Weight</h3>
            <p className="text-sm text-gray-600 mb-3">Your primary target (typically 15% body weight loss)</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                value={goals.goal_weight_min || ''}
                onChange={(e) => setGoals({ ...goals, goal_weight_min: parseFloat(e.target.value) || null })}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-lg font-semibold"
                placeholder="Enter minimum goal"
              />
              <span className="text-gray-600 font-semibold">kg</span>
            </div>
            {lossPercentage && (
              <div className="mt-2 text-sm font-semibold text-green-600">
                This is a {lossPercentage}% weight loss
              </div>
            )}
          </div>

          {/* Secondary Goal (Optional) */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">🏆 Secondary Goal Weight (Optional)</h3>
            <p className="text-sm text-gray-600 mb-3">Your stretch target if you want to go beyond the minimum</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                value={goals.goal_weight_max || ''}
                onChange={(e) => setGoals({ ...goals, goal_weight_max: parseFloat(e.target.value) || null })}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-lg font-semibold"
                placeholder="Enter secondary goal (optional)"
              />
              <span className="text-gray-600 font-semibold">kg</span>
            </div>
          </div>

          {/* Summary */}
          {goals.initial_weight && goals.goal_weight_min && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Your Journey</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Starting Weight:</span>
                  <span className="text-xl font-bold text-gray-900">{goals.initial_weight} kg</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Target Loss:</span>
                  <span className="text-xl font-bold text-green-600">
                    {(goals.initial_weight - goals.goal_weight_min).toFixed(1)} kg ({lossPercentage}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Minimum Goal:</span>
                  <span className="text-xl font-bold text-green-700">{goals.goal_weight_min} kg</span>
                </div>
                {goals.goal_weight_max && (
                  <div className="flex justify-between items-center pt-2 border-t border-green-300">
                    <span className="text-gray-700">Secondary Goal:</span>
                    <span className="text-xl font-bold text-emerald-700">{goals.goal_weight_max} kg</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={saveGoals}
          disabled={saving}
          className="w-full mt-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Goals'}
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
