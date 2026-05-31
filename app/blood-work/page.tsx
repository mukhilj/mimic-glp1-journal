'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Plus, ChevronLeft, Loader, AlertCircle, Calendar, ChevronRight } from 'lucide-react';

interface BloodWorkEntry {
  id: number;
  test_date: string;
  source: string;
  marker_code: string;
  marker_name: string;
  domain: string;
  value: number;
  unit: string;
  status: string;
  notes: string;
}

export default function BloodWorkPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BloodWorkEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<BloodWorkEntry[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [domains, setDomains] = useState<string[]>([]);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (user) loadEntries(user.id);
  }, [user]);

  useEffect(() => {
    setFilteredEntries(selectedDomain === 'All' ? entries : entries.filter(e => e.domain === selectedDomain));
  }, [entries, selectedDomain]);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadEntries(userId: string) {
    const { data, error } = await supabase
      .from('blood_work_entries').select('*').eq('user_id', userId).order('test_date', { ascending: false });
    if (error) { console.error(error); return; }
    if (data) {
      setEntries(data);
      setDomains([...new Set(data.map(e => e.domain))].sort());
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'Normal': return 'bg-green-100 text-green-800';
      case 'Low': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Critical_Low': case 'Critical_High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'Normal': return '✓';
      case 'Low': return '↓';
      case 'High': return '↑';
      case 'Critical_Low': case 'Critical_High': return '⚠';
      default: return '•';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-white text-xl font-semibold flex items-center gap-2">
          <Loader className="animate-spin" size={24} /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {/* Header */}
      <div className="bg-black/30 text-white">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2 rounded-lg transition font-semibold text-sm">
                <ChevronLeft size={16} /> Dashboard
              </button>
              <h1 className="text-xl md:text-3xl font-bold">🧪 Blood Work</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/blood-work/upload')}
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition font-semibold text-xs md:text-sm">
                📤 Upload
              </button>
              <button onClick={() => router.push('/blood-work/entry')}
                className="flex items-center gap-1 md:gap-2 bg-white/20 hover:bg-white/30 px-3 md:px-5 py-2 rounded-lg transition font-semibold text-xs md:text-sm">
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
          <p className="text-white/70 text-sm">Tap any marker to view its trend chart.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6">

        {/* Domain Filter — horizontal scroll on mobile */}
        {domains.length > 0 && (
          <div className="mb-4 bg-white rounded-xl shadow-md p-3 md:p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setSelectedDomain('All')}
                className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${selectedDomain === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                All ({entries.length})
              </button>
              {domains.map(domain => (
                <button key={domain} onClick={() => setSelectedDomain(domain)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold text-sm transition ${selectedDomain === domain ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                  {domain} ({entries.filter(e => e.domain === domain).length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No entries */}
        {entries.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-5xl mb-4">🧪</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Blood Work Entries Yet</h2>
            <p className="text-gray-500 mb-6">Add your first blood test result to start tracking your health markers.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => router.push('/blood-work/entry')}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                <Plus size={18} /> Add Single Entry
              </button>
              <button onClick={() => router.push('/blood-work/upload')}
                className="flex items-center justify-center gap-2 bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
                📤 Bulk Upload CSV
              </button>
            </div>
          </div>
        )}

        {/* Entries — clickable, links to trend chart */}
        {filteredEntries.length > 0 && (
          <div className="space-y-3">
            {filteredEntries.map(entry => (
              <button key={entry.id} onClick={() => router.push(`/blood-work/${entry.marker_code.toLowerCase()}`)}
                className="w-full bg-white rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg hover:bg-blue-50/30 transition text-left group">
                <div className="flex items-center justify-between">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900">{entry.marker_code}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(entry.status)}`}>
                        {getStatusIcon(entry.status)} {entry.status === 'Critical_Low' ? 'Critical ↓' : entry.status === 'Critical_High' ? 'Critical ↑' : entry.status}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-gray-500 truncate">{entry.marker_name}</p>
                    <p className="text-xs text-gray-400">{entry.domain}</p>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2 md:gap-3 ml-3">
                    <div className="text-right">
                      <div className="text-xl md:text-2xl font-bold text-blue-600">{entry.value}</div>
                      <div className="text-xs text-gray-500">{entry.unit}</div>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <Calendar size={11} className="text-gray-400" />
                        <span className="text-xs text-gray-400">{new Date(entry.test_date).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition" />
                  </div>
                </div>

                {entry.notes && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                    <p className="text-xs text-gray-600 truncate">{entry.notes}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {entries.length > 0 && filteredEntries.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600">No entries in <strong>{selectedDomain}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}
