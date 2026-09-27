'use client';

// app/protocol/page.tsx
// One-year protocol: this week's adherence for you and (once both of you link) your partner.
// Your own days are re-scored live from your logs. Your partner's come from the stored pass/fail
// flags via get_partner_protocol(), which never returns weight, food or notes.

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DailyLog } from '@/lib/types';
import { formatDateForDB } from '@/lib/utils';
import {
  PROTOCOL_START,
  PROTOCOL_DAYS,
  PROTOCOL_TARGETS,
  DAILY_HABITS,
  DailyHabit,
  ProtocolDay,
  addDays,
  protocolDayNumber,
  protocolWeek,
  weekDates,
  evaluateAll,
  summarizeWeek,
  currentStreak,
  longFastStatus,
} from '@/lib/protocol';

// "2026-09-27" -> "27 Sep"
function shortDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProtocolPage() {
  const router = useRouter();
  const supabase = createClient();
  const today = formatDateForDB(new Date());
  const thisWeek = Math.max(1, protocolWeek(today));

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [week, setWeek] = useState(thisWeek);
  const [myDays, setMyDays] = useState<Map<string, ProtocolDay>>(new Map());
  const [partnerDays, setPartnerDays] = useState<Map<string, ProtocolDay> | null>(null);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [savedPartnerEmail, setSavedPartnerEmail] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
    await Promise.all([loadMine(user.id), loadPartner(user.id)]);
    setLoading(false);
  }

  // Own logs from the day before Day 1 (needed to score Day 1's 16h fast)
  async function loadMine(uid: string) {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('log_date, meal_times, meals_check, no_sugar, fast_36h, movement_steps, sleep_items, movement_items')
      .eq('user_id', uid)
      .gte('log_date', addDays(PROTOCOL_START, -1));
    if (error) {
      setError(error.message);
      return;
    }
    const scored = evaluateAll((data || []) as DailyLog[]);
    scored.delete(addDays(PROTOCOL_START, -1));
    setMyDays(scored);
  }

  // Partner link + partner's pass/fail flags (only returned when both sides have linked)
  async function loadPartner(uid: string) {
    const { data: row, error: rowErr } = await supabase
      .from('protocol_partners')
      .select('partner_email')
      .eq('user_id', uid)
      .maybeSingle();
    if (rowErr) {
      setError('Partner tables missing. Run supabase/protocol-schema.sql in the Supabase SQL Editor. (' + rowErr.message + ')');
      return;
    }
    setSavedPartnerEmail(row?.partner_email ?? null);
    setPartnerEmail(row?.partner_email ?? '');

    const { data: partnerId } = await supabase.rpc('protocol_partner_id');
    if (!partnerId) {
      setLinked(false);
      setPartnerDays(null);
      return;
    }
    setLinked(true);
    const { data, error } = await supabase.rpc('get_partner_protocol', { p_from: PROTOCOL_START, p_to: today });
    if (error) {
      setError(error.message);
      return;
    }
    setPartnerDays(new Map(((data || []) as ProtocolDay[]).map(d => [d.log_date, d])));
  }

  async function savePartner() {
    if (!userId) return;
    setSaving(true);
    setError('');
    const email = partnerEmail.trim().toLowerCase();
    const { error } = email
      ? await supabase
          .from('protocol_partners')
          .upsert({ user_id: userId, partner_email: email, updated_at: new Date().toISOString() })
      : await supabase.from('protocol_partners').delete().eq('user_id', userId);
    if (error) setError(error.message);
    await loadPartner(userId);
    setSaving(false);
  }

  // Declared after the loaders so the React compiler lint rule is satisfied; runs once on mount
  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const dayNum = Math.min(Math.max(protocolDayNumber(today), 0), PROTOCOL_DAYS);
  const dates = weekDates(week);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-500">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-600 hover:text-gray-900">
              ← Dashboard
            </button>
            <button onClick={() => router.push('/daily-log')} className="text-sm font-semibold text-emerald-700 hover:underline">
              Log today →
            </button>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">One-Year Protocol</h1>
          <p className="text-sm text-gray-600 mt-1">
            Day {dayNum} of {PROTOCOL_DAYS} · {shortDate(PROTOCOL_START)} 2026 to {shortDate(addDays(PROTOCOL_START, PROTOCOL_DAYS - 1))} 2027
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(dayNum / PROTOCOL_DAYS) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Daily: 16h fast, diet (bowls + no sugar), {PROTOCOL_TARGETS.steps.toLocaleString('en-IN')} steps, {PROTOCOL_TARGETS.sleepHours}h sleep.
            Weekly: strength {PROTOCOL_TARGETS.strengthPerWeek}x. Fortnightly: one 36h fast.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between bg-white/20 backdrop-blur-sm text-white rounded-xl p-3 mb-6">
          <button disabled={week <= 1} onClick={() => setWeek(week - 1)} className="p-2 disabled:opacity-30">
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <div className="text-lg md:text-xl font-bold">Week {week}</div>
            <div className="text-xs md:text-sm text-white/80">
              {shortDate(dates[0])} to {shortDate(dates[6])}
              {week === thisWeek ? ' · this week' : ''}
            </div>
          </div>
          <button disabled={week >= thisWeek} onClick={() => setWeek(week + 1)} className="p-2 disabled:opacity-30">
            <ChevronRight size={22} />
          </button>
        </div>

        <PersonCard title="You" days={myDays} week={week} today={today} />

        {linked && partnerDays ? (
          <PersonCard title={savedPartnerEmail ? `Partner (${savedPartnerEmail})` : 'Partner'} days={partnerDays} week={week} today={today} />
        ) : (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900">Partner</h2>
            <p className="text-sm text-gray-600 mt-1 mb-3">
              {savedPartnerEmail
                ? `Waiting for ${savedPartnerEmail} to add your email on their Protocol page. Nothing is shared until both of you have linked.`
                : "Enter your partner's login email. They do the same with yours. Only the protocol ticks are shared, never weight, food or notes."}
            </p>
          </div>
        )}

        {/* Partner link form (always available so the link can be changed or removed) */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
          <label className="text-sm font-semibold text-gray-800">Partner&apos;s login email</label>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <input
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              placeholder="partner@example.com"
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none text-sm"
            />
            <button
              onClick={savePartner}
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : partnerEmail.trim() ? 'Save link' : 'Remove link'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">{linked ? 'Linked both ways ✓' : 'Not linked yet'}</p>
        </div>
      </div>
    </div>
  );
}

// One person's week: daily grid, weekly totals, streaks and the 36h fast status
function PersonCard({
  title,
  days,
  week,
  today,
}: {
  title: string;
  days: Map<string, ProtocolDay>;
  week: number;
  today: string;
}) {
  const dates = weekDates(week);
  const summary = summarizeWeek(days, week, today);
  const longFast = longFastStatus(days, today);

  // ✓ passed, ✗ logged but missed, – not logged (counts as a miss), blank = future / before Day 1
  function cell(date: string, pass: boolean | undefined) {
    if (date > today || date < PROTOCOL_START) return <span className="text-gray-300">·</span>;
    if (pass === undefined) return <span className="text-gray-400">–</span>;
    return pass ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-red-500 font-bold">✗</span>;
  }

  const rowClass = 'text-center py-2 text-sm';

  return (
    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
        <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">
          Perfect days: <b>{summary.perfectDays}</b>/{summary.elapsedDays}
        </span>
      </div>

      {/* Daily grid (scrolls sideways on small phones instead of squashing) */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-medium py-1">Habit</th>
              {dates.map((d, i) => (
                <th key={d} className="font-medium py-1">
                  {WEEKDAYS[i]}
                  <div className="text-[10px] text-gray-400">{shortDate(d)}</div>
                </th>
              ))}
              <th className="font-medium py-1">Week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {DAILY_HABITS.map(h => (
              <tr key={h.key} title={h.hint}>
                <td className="py-2 text-sm font-semibold text-gray-800">{h.label}</td>
                {dates.map(d => (
                  <td key={d} className={rowClass}>{cell(d, days.get(d)?.[h.key])}</td>
                ))}
                <td className={`${rowClass} font-semibold text-gray-700`}>
                  {summary.habits[h.key]}/{summary.elapsedDays}
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2 text-sm font-semibold text-gray-800">Strength</td>
              {dates.map(d => (
                <td key={d} className={rowClass}>
                  {d > today || d < PROTOCOL_START ? (
                    <span className="text-gray-300">·</span>
                  ) : days.get(d)?.p_strength ? (
                    <span className="text-emerald-600 font-bold">S</span>
                  ) : (
                    <span className="text-gray-300">·</span>
                  )}
                </td>
              ))}
              <td
                className={`${rowClass} font-semibold ${summary.strength >= PROTOCOL_TARGETS.strengthPerWeek ? 'text-emerald-600' : 'text-gray-700'}`}
              >
                {summary.strength}/{PROTOCOL_TARGETS.strengthPerWeek}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Streaks (as of today) and the fortnightly 36h fast */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
        {DAILY_HABITS.map(h => (
          <div key={h.key} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">{h.label} streak</div>
            <div className="text-lg font-bold text-gray-900">{currentStreak(days, h.key as DailyHabit, today)}d</div>
          </div>
        ))}
        <div className={`rounded-lg p-3 ${longFast.doneThisFortnight ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <div className="text-xs text-gray-500">36h fast (fortnight {longFast.index})</div>
          <div className={`text-sm font-bold ${longFast.doneThisFortnight ? 'text-emerald-700' : 'text-amber-700'}`}>
            {longFast.doneThisFortnight ? 'Done ✓' : `Due by ${shortDate(longFast.to)}`}
          </div>
          <div className="text-[10px] text-gray-500">Last: {longFast.last ? shortDate(longFast.last) : 'none yet'}</div>
        </div>
      </div>
    </div>
  );
}
