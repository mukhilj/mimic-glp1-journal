'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Calendar, TrendingDown, Target, BookOpen, CalendarDays, CalendarRange, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    currentStreak: 0,
    totalLogs: 0,
    weightChange: null as number | null,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

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
      await loadStats(user.id);
      await loadRecentLogs(user.id);
    }
    setLoading(false);
  }

  async function loadStats(userId: string) {
    // Get all logs
    const { data: logs } = await supabase
      .from('daily_logs')
      .select('log_date, weight')
      .eq('user_id', userId)
      .order('log_date', { ascending: false });

    if (logs && logs.length > 0) {
      // Calculate streak
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < logs.length; i++) {
        const logDate = new Date(logs[i].log_date);
        logDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);

        if (logDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }

      // Calculate weight change
      const logsWithWeight = logs.filter(l => l.weight);
      let weightChange = null;
      if (logsWithWeight.length >= 2) {
        const latest = logsWithWeight[0].weight;
        const earliest = logsWithWeight[logsWithWeight.length - 1].weight;
        weightChange = latest - earliest;
      }

      setStats({
        currentStreak: streak,
        totalLogs: logs.length,
        weightChange,
      });
    }
  }

  async function loadRecentLogs(userId: string) {
    const { data: logs } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(5);

    if (logs) {
      setRecentLogs(logs);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
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
      <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white p-6 md:p-8 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Health Dashboard</h1>
              <p className="text-white/80 mt-1">Welcome back, {user?.email?.split('@')[0]}!</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition text-sm font-semibold backdrop-blur-sm"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/80 text-sm mb-1">Current Streak</div>
              <div className="text-3xl font-bold">{stats.currentStreak} days</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/80 text-sm mb-1">Total Logs</div>
              <div className="text-3xl font-bold">{stats.totalLogs}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/80 text-sm mb-1">Weight Progress</div>
              <div className="text-3xl font-bold">
                {stats.weightChange !== null ? (
                  <>
                    {stats.weightChange > 0 ? '+' : ''}
                    {stats.weightChange.toFixed(1)} kg
                  </>
                ) : (
                  '--'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Daily Log */}
          <button
            onClick={() => router.push('/daily-log')}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition group text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl group-hover:scale-110 transition">
                <Calendar className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Daily Log</h3>
                <p className="text-gray-600 text-sm">Track your daily progress</p>
              </div>
            </div>
            <div className="text-indigo-600 font-semibold group-hover:translate-x-2 transition">
              Log Today →
            </div>
          </button>

          {/* Weekly Reflection */}
          <button
            onClick={() => router.push('/weekly-reflection')}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition group text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl group-hover:scale-110 transition">
                <CalendarDays className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Weekly Reflection</h3>
                <p className="text-gray-600 text-sm">Review your week</p>
              </div>
            </div>
            <div className="text-purple-600 font-semibold group-hover:translate-x-2 transition">
              Start Reflection →
            </div>
          </button>

          {/* Monthly Reflection */}
          <button
            onClick={() => router.push('/monthly-reflection')}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition group text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-3 rounded-xl group-hover:scale-110 transition">
                <CalendarRange className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Monthly Reflection</h3>
                <p className="text-gray-600 text-sm">Deep monthly review</p>
              </div>
            </div>
            <div className="text-pink-600 font-semibold group-hover:translate-x-2 transition">
              Start Reflection →
            </div>
          </button>

          {/* Goals & Targets */}
          <button
            onClick={() => router.push('/goals')}
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition group text-left"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-xl group-hover:scale-110 transition">
                <Target className="text-white" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Goals & Targets</h3>
                <p className="text-gray-600 text-sm">Set your weight goals</p>
              </div>
            </div>
            <div className="text-green-600 font-semibold group-hover:translate-x-2 transition">
              Set Goals →
            </div>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen size={24} className="text-indigo-600" />
            Recent Activity
          </h2>
          
          {recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-semibold text-gray-900">
                      {new Date(log.log_date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex gap-2">
                      {log.meals_check && (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                          Meals ✓
                        </span>
                      )}
                      {log.movement_check && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                          Movement ✓
                        </span>
                      )}
                      {log.weight && (
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold">
                          {log.weight} kg
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/daily-log')}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold"
                  >
                    View →
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No logs yet. Start by creating your first daily log!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
