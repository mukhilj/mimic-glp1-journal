'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Calendar, Target, BookOpen, CalendarDays, CalendarRange, LogOut, Droplet, AlertCircle } from 'lucide-react';

interface BloodWorkSummary {
  totalEntries: number;
  latestDate: string | null;
  normalCount: number;
  highCount: number;
  lowCount: number;
  criticalCount: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ currentStreak: 0, totalLogs: 0, weightChange: null as number | null });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [bloodWorkSummary, setBloodWorkSummary] = useState<BloodWorkSummary | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { checkUser(); }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    await Promise.all([loadStats(user.id), loadRecentLogs(user.id), loadBloodWorkSummary(user.id)]);
    setLoading(false);
  }

  async function loadStats(userId: string) {
    const { data: logs } = await supabase
      .from('daily_logs').select('log_date, weight').eq('user_id', userId).order('log_date', { ascending: false });

    if (logs && logs.length > 0) {
      let streak = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = 0; i < logs.length; i++) {
        const logDate = new Date(logs[i].log_date); logDate.setHours(0, 0, 0, 0);
        const expected = new Date(today); expected.setDate(today.getDate() - i); expected.setHours(0, 0, 0, 0);
        if (logDate.getTime() === expected.getTime()) streak++;
        else break;
      }
      const logsWithWeight = logs.filter(l => l.weight);
      const weightChange = logsWithWeight.length >= 2
        ? logsWithWeight[0].weight - logsWithWeight[logsWithWeight.length - 1].weight
        : null;
      setStats({ currentStreak: streak, totalLogs: logs.length, weightChange });
    }
  }

  async function loadRecentLogs(userId: string) {
    const { data: logs } = await supabase.from('daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(5);
    if (logs) setRecentLogs(logs);
  }

  async function loadBloodWorkSummary(userId: string) {
    const { data } = await supabase
      .from('blood_work_entries')
      .select('status, test_date')
      .eq('user_id', userId)
      .order('test_date', { ascending: false });

    if (!data || data.length === 0) return;

    const summary: BloodWorkSummary = {
      totalEntries: data.length,
      latestDate: data[0]?.test_date || null,
      normalCount: data.filter(d => d.status === 'Normal').length,
      highCount: data.filter(d => d.status === 'High').length,
      lowCount: data.filter(d => d.status === 'Low').length,
      criticalCount: data.filter(d => d.status === 'Critical_Low' || d.status === 'Critical_High').length,
    };
    setBloodWorkSummary(summary);
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
      <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white p-4 md:p-8 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold">Health Dashboard</h1>
              <p className="text-white/80 mt-1 text-sm md:text-base">Welcome back, {user?.email?.split('@')[0]}!</p>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={() => router.push('/profile')}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-lg transition text-xs md:text-sm font-semibold">
                👤 Profile
              </button>
              <button onClick={handleSignOut}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-lg transition text-xs md:text-sm font-semibold">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 md:p-4">
              <div className="text-white/80 text-xs md:text-sm mb-1">Streak</div>
              <div className="text-xl md:text-3xl font-bold">{stats.currentStreak} <span className="text-sm md:text-base font-normal">days</span></div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 md:p-4">
              <div className="text-white/80 text-xs md:text-sm mb-1">Total Logs</div>
              <div className="text-xl md:text-3xl font-bold">{stats.totalLogs}</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 md:p-4">
              <div className="text-white/80 text-xs md:text-sm mb-1">Weight Change</div>
              <div className="text-xl md:text-3xl font-bold">
                {stats.weightChange !== null ? `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange.toFixed(1)}` : '--'}
                <span className="text-sm md:text-base font-normal"> kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">

        {/* ── NAVIGATION CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-6">
          {[
            { label: 'Daily Log', sub: 'Track your daily progress', color: 'from-blue-500 to-indigo-600', textColor: 'text-indigo-600', icon: <Calendar size={28} className="text-white" />, cta: 'Log Today →', route: '/daily-log' },
            { label: 'Weekly Reflection', sub: 'Review your week', color: 'from-purple-500 to-indigo-600', textColor: 'text-purple-600', icon: <CalendarDays size={28} className="text-white" />, cta: 'Start Reflection →', route: '/weekly-reflection' },
            { label: 'Monthly Reflection', sub: 'Deep monthly review', color: 'from-pink-500 to-purple-600', textColor: 'text-pink-600', icon: <CalendarRange size={28} className="text-white" />, cta: 'Start Reflection →', route: '/monthly-reflection' },
            { label: 'Goals & Targets', sub: 'Set your weight goals', color: 'from-green-500 to-emerald-600', textColor: 'text-green-600', icon: <Target size={28} className="text-white" />, cta: 'Set Goals →', route: '/goals' },
          ].map(({ label, sub, color, textColor, icon, cta, route }) => (
            <button key={route} onClick={() => router.push(route)}
              className="bg-white rounded-xl shadow-lg p-5 md:p-6 hover:shadow-xl transition group text-left">
              <div className="flex items-center gap-4 mb-3">
                <div className={`bg-gradient-to-br ${color} p-3 rounded-xl group-hover:scale-110 transition`}>{icon}</div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">{label}</h3>
                  <p className="text-gray-600 text-xs md:text-sm">{sub}</p>
                </div>
              </div>
              <div className={`${textColor} font-semibold text-sm group-hover:translate-x-2 transition`}>{cta}</div>
            </button>
          ))}
        </div>

        {/* ── BLOOD WORK TRACKER CARD (Phase 4.4 — with live summary) ── */}
        <div className="bg-white rounded-xl shadow-lg p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-cyan-500 to-teal-600 p-3 rounded-xl">
                <Droplet size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Blood Work Tracker</h3>
                <p className="text-gray-500 text-xs md:text-sm">
                  {bloodWorkSummary
                    ? `Last tested: ${new Date(bloodWorkSummary.latestDate!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : 'No entries yet'}
                </p>
              </div>
            </div>
            <button onClick={() => router.push('/blood-work')}
              className="text-cyan-600 font-semibold text-sm hover:text-cyan-700 transition">
              View All →
            </button>
          </div>

          {bloodWorkSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{bloodWorkSummary.totalEntries}</div>
                <div className="text-xs text-gray-500">Total Tests</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{bloodWorkSummary.normalCount}</div>
                <div className="text-xs text-green-600">Normal</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{bloodWorkSummary.highCount + bloodWorkSummary.lowCount}</div>
                <div className="text-xs text-orange-600">High / Low</div>
              </div>
              <div className={`rounded-lg p-3 text-center ${bloodWorkSummary.criticalCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${bloodWorkSummary.criticalCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>{bloodWorkSummary.criticalCount}</div>
                <div className={`text-xs ${bloodWorkSummary.criticalCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>Critical</div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">Add your first blood test to start tracking your health markers.</p>
          )}

          {/* CTA buttons */}
          {bloodWorkSummary?.criticalCount ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3 text-sm">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span className="text-red-800 font-medium">{bloodWorkSummary.criticalCount} critical marker{bloodWorkSummary.criticalCount > 1 ? 's' : ''} need attention</span>
              <button onClick={() => router.push('/blood-work')} className="ml-auto text-red-600 font-semibold underline">View</button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button onClick={() => router.push('/blood-work/entry')}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg font-semibold text-sm transition">
              + Add Entry
            </button>
            <button onClick={() => router.push('/blood-work/upload')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold text-sm transition">
              📤 Bulk Upload
            </button>
          </div>
        </div>

        {/* ── RECENT ACTIVITY ── */}
        <div className="bg-white rounded-xl shadow-lg p-5 md:p-6">
          <h2 className="text-lg md:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen size={22} className="text-indigo-600" /> Recent Activity
          </h2>
          {recentLogs.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center gap-3">
                    <div className="text-sm md:text-lg font-semibold text-gray-900">
                      {new Date(log.log_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                    <div className="flex flex-wrap gap-1 md:gap-2">
                      {log.meals_check && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">Meals ✓</span>}
                      {log.movement_check && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">Movement ✓</span>}
                      {log.weight && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold">{log.weight} kg</span>}
                    </div>
                  </div>
                  <button onClick={() => router.push('/daily-log')} className="text-indigo-600 hover:text-indigo-700 text-xs md:text-sm font-semibold">View →</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-gray-500 text-sm">No logs yet. Start with your first daily log!</p>
          )}
        </div>
      </div>
    </div>
  );
}
