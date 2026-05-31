'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Dot
} from 'recharts';
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Calendar, Activity } from 'lucide-react';

interface Entry {
  id: number;
  test_date: string;
  value: number;
  unit: string;
  status: string;
  source: string;
  notes: string;
}

interface MarkerInfo {
  marker_code: string;
  marker_name: string;
  domain: string;
  unit: string;
  ref_min_male: number | null;
  ref_max_male: number | null;
  ref_min_female: number | null;
  ref_max_female: number | null;
}

export default function MarkerTrendPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [markerInfo, setMarkerInfo] = useState<MarkerInfo | null>(null);
  const [refMin, setRefMin] = useState<number | null>(null);
  const [refMax, setRefMax] = useState<number | null>(null);

  const router = useRouter();
  const params = useParams();
  const markerCode = (params?.marker as string || '').toUpperCase();

  const supabase = createClient();

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (user && markerCode) {
      loadData(user.id);
    }
  }, [user, markerCode]);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadData(userId: string) {
    // Load marker info + gender for reference ranges
    const [{ data: marker }, { data: profile }] = await Promise.all([
      supabase.from('health_markers_library').select('*').eq('marker_code', markerCode).single(),
      supabase.from('user_preferences').select('gender').eq('user_id', userId).single(),
    ]);

    if (marker) {
      setMarkerInfo(marker);
      const gender = profile?.gender || 'M';
      const min = gender === 'F' ? marker.ref_min_female : marker.ref_min_male;
      const max = gender === 'F' ? marker.ref_max_female : marker.ref_max_male;
      setRefMin(min ?? null);
      setRefMax(max ?? null);
    }

    // Load all entries for this marker, sorted by date ascending
    const { data: entriesData } = await supabase
      .from('blood_work_entries')
      .select('id, test_date, value, unit, status, source, notes')
      .eq('user_id', userId)
      .eq('marker_code', markerCode)
      .order('test_date', { ascending: true });

    if (entriesData) setEntries(entriesData);
  }

  // ── Chart data ───────────────────────────────────────────────────
  const chartData = entries.map(e => ({
    date: new Date(e.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }),
    value: e.value,
    status: e.status,
    rawDate: e.test_date,
  }));

  // ── Stats ────────────────────────────────────────────────────────
  const latest = entries[entries.length - 1];
  const previous = entries[entries.length - 2];
  const allValues = entries.map(e => e.value);
  const minVal = allValues.length ? Math.min(...allValues) : null;
  const maxVal = allValues.length ? Math.max(...allValues) : null;
  const avgVal = allValues.length ? +(allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(1) : null;

  const trend = latest && previous
    ? latest.value > previous.value ? 'up'
    : latest.value < previous.value ? 'down' : 'flat'
    : null;

  const trendDiff = latest && previous ? +(latest.value - previous.value).toFixed(2) : null;

  // ── Chart Y-axis domain (add 20% padding around ref range + values) ──
  const allY = [...allValues, refMin, refMax].filter(v => v !== null) as number[];
  const yMin = allY.length ? +(Math.min(...allY) * 0.85).toFixed(1) : 0;
  const yMax = allY.length ? +(Math.max(...allY) * 1.15).toFixed(1) : 100;

  function getStatusColor(status: string) {
    switch (status) {
      case 'Normal': return '#16a34a';
      case 'Low': return '#ca8a04';
      case 'High': return '#ea580c';
      case 'Critical_Low': case 'Critical_High': return '#dc2626';
      default: return '#6b7280';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'Normal': return 'bg-green-100 text-green-800';
      case 'Low': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Critical_Low': case 'Critical_High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Custom dot — color by status
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = getStatusColor(payload.status);
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <div className="font-semibold text-gray-900 mb-1">{d.date}</div>
        <div className="text-blue-700 font-bold text-lg">{d.value} <span className="text-sm text-gray-500">{markerInfo?.unit}</span></div>
        <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${getStatusBadge(d.status)}`}>{d.status}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  if (!markerInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-white text-center">
          <div className="text-4xl mb-4">🔍</div>
          <div className="text-xl font-semibold">Marker not found</div>
          <button onClick={() => router.push('/blood-work')} className="mt-4 bg-white/20 px-6 py-2 rounded-lg font-semibold">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {/* Header */}
      <div className="bg-black/30 text-white">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex items-center gap-4 mb-2">
            <button onClick={() => router.push('/blood-work')}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition font-semibold">
              <ChevronLeft size={16} /> Back
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{markerInfo.marker_code} — {markerInfo.marker_name}</h1>
              <p className="text-white/70 text-sm">{markerInfo.domain} · {markerInfo.unit}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {entries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No data for {markerInfo.marker_code}</h2>
            <p className="text-gray-500 mb-4">Add your first entry to start tracking this marker.</p>
            <button onClick={() => router.push('/blood-work/entry')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
              Add Entry
            </button>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Latest */}
              <div className="bg-white rounded-xl shadow-md p-4 col-span-2 md:col-span-1">
                <div className="text-xs text-gray-500 mb-1">Latest Value</div>
                <div className="text-2xl font-bold text-gray-900">{latest?.value}</div>
                <div className="text-sm text-gray-500">{markerInfo.unit}</div>
                {latest && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${getStatusBadge(latest.status)}`}>
                    {latest.status}
                  </span>
                )}
              </div>

              {/* Trend */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="text-xs text-gray-500 mb-1">Trend</div>
                {trend === 'up' && <TrendingUp size={28} className="text-orange-500 mb-1" />}
                {trend === 'down' && <TrendingDown size={28} className="text-blue-500 mb-1" />}
                {trend === 'flat' && <Minus size={28} className="text-gray-400 mb-1" />}
                {trend === null && <Minus size={28} className="text-gray-300 mb-1" />}
                <div className="text-sm font-semibold text-gray-700">
                  {trendDiff !== null ? (trendDiff > 0 ? `+${trendDiff}` : `${trendDiff}`) : '—'}
                </div>
                <div className="text-xs text-gray-400">vs previous</div>
              </div>

              {/* Min/Max */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="text-xs text-gray-500 mb-1">Min / Max</div>
                <div className="text-sm font-bold text-blue-700">{minVal}</div>
                <div className="text-xs text-gray-400">min</div>
                <div className="text-sm font-bold text-orange-600 mt-1">{maxVal}</div>
                <div className="text-xs text-gray-400">max</div>
              </div>

              {/* Average + count */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="text-xs text-gray-500 mb-1">Average</div>
                <div className="text-xl font-bold text-gray-900">{avgVal}</div>
                <div className="text-xs text-gray-400">{markerInfo.unit}</div>
                <div className="flex items-center gap-1 mt-2">
                  <Activity size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{entries.length} tests</span>
                </div>
              </div>
            </div>

            {/* Reference range info */}
            {refMin !== null && refMax !== null && (
              <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-100 border border-green-300"></div>
                  <span className="text-gray-600">Reference range: <strong>{refMin} – {refMax} {markerInfo.unit}</strong></span>
                </div>
                <div className="text-gray-400 text-xs">Shaded green zone on chart</div>
              </div>
            )}

            {/* Trend Chart */}
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">📈 Historical Trend</h2>
              <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11 }} tickLine={false} width={50} />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Reference range shaded area */}
                    {refMin !== null && refMax !== null && (
                      <ReferenceArea y1={refMin} y2={refMax} fill="#dcfce7" fillOpacity={0.6} />
                    )}

                    {/* Upper ref line */}
                    {refMax !== null && (
                      <ReferenceLine y={refMax} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5}
                        label={{ value: `Max ${refMax}`, position: 'insideTopRight', fontSize: 10, fill: '#16a34a' }} />
                    )}
                    {/* Lower ref line */}
                    {refMin !== null && (
                      <ReferenceLine y={refMin} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1.5}
                        label={{ value: `Min ${refMin}`, position: 'insideBottomRight', fontSize: 10, fill: '#16a34a' }} />
                    )}

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={<CustomDot />}
                      activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">📋 All Entries</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Date</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Value</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Source</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...entries].reverse().map(e => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <Calendar size={13} className="text-gray-400" />
                            <span>{new Date(e.test_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-bold text-blue-700">{e.value} <span className="text-xs text-gray-500 font-normal">{markerInfo.unit}</span></td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getStatusBadge(e.status)}`}>
                            {e.status === 'Critical_Low' ? 'Critical ↓' : e.status === 'Critical_High' ? 'Critical ↑' : e.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-xs">{e.source || '—'}</td>
                        <td className="py-2 px-3 text-gray-500 text-xs">{e.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
